import { env } from "../../config/env";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — enough to survive repeat lookups during a demo without re-spending quota
const FETCH_TIMEOUT_MS = 3000;

export interface AbuseIpdbResult {
  abuseScore: number;
  countryCode: string | null;
  isp: string | null;
}

const cache = new Map<string, { result: AbuseIpdbResult; expiresAt: number }>();

/**
 * Optional AbuseIPDB abuse-confidence lookup, gated behind ENABLE_TI_ENRICHMENT
 * so the demo runs fully offline by default. Any failure (no key, network,
 * bad response, timeout) resolves to null silently — this must never block a
 * report submission or an access-attempt risk score.
 */
export async function checkIp(ip: string): Promise<AbuseIpdbResult | null> {
  if (!env.ENABLE_TI_ENRICHMENT || !env.ABUSEIPDB_API_KEY) {
    return null;
  }

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`, {
      headers: { Key: env.ABUSEIPDB_API_KEY, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const body = (await response.json()) as {
      data?: { abuseConfidenceScore?: number; countryCode?: string | null; isp?: string | null };
    };
    if (typeof body.data?.abuseConfidenceScore !== "number") return null;

    const result: AbuseIpdbResult = {
      abuseScore: body.data.abuseConfidenceScore,
      countryCode: body.data.countryCode ?? null,
      isp: body.data.isp ?? null,
    };
    cache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    return null;
  }
}
