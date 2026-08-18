import { resolve4 } from "node:dns/promises";
import type { IndicatorType } from "@sixsync/shared";

const DNS_TIMEOUT_MS = 2000;

// Venue wifi / DNS can be unreliable during a live demo — this table guarantees
// a handful of well-known demo/test domains still resolve to *something* even
// when real DNS is unavailable, so the pipeline never silently produces zero data.
const FALLBACK_TABLE: Record<string, string> = {
  "example.com": "93.184.216.34",
  "secure-login-verify.example": "198.51.100.42",
};

export type ResolutionSource = "direct" | "dns" | "fallback" | "unresolved";

export interface ResolutionResult {
  ip: string | null;
  via: ResolutionSource;
}

function extractHostname(indicator: string, indicatorType: IndicatorType): string | null {
  if (indicatorType === "DOMAIN") return indicator;
  if (indicatorType === "URL") {
    try {
      return new URL(indicator).hostname;
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveWithTimeout(hostname: string): Promise<string | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DNS_TIMEOUT_MS));
  try {
    const addresses = await Promise.race([resolve4(hostname), timeout]);
    return addresses && addresses.length > 0 ? addresses[0] : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a threat indicator to an IP address. Never throws — always resolves
 * to a result, falling back to a small hardcoded table when real DNS fails or
 * times out, so a report submission is never blocked by network flakiness.
 */
export async function resolveIndicatorToIp(indicator: string, indicatorType: IndicatorType): Promise<ResolutionResult> {
  if (indicatorType === "IP") {
    return { ip: indicator, via: "direct" };
  }

  const hostname = extractHostname(indicator, indicatorType);
  if (!hostname) {
    return { ip: null, via: "unresolved" };
  }

  const dnsResult = await resolveWithTimeout(hostname);
  if (dnsResult) {
    return { ip: dnsResult, via: "dns" };
  }

  const fallback = FALLBACK_TABLE[hostname];
  return fallback ? { ip: fallback, via: "fallback" } : { ip: null, via: "unresolved" };
}
