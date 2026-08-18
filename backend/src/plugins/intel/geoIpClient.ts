import { env } from "../../config/env";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — IP geolocation is stable, cache aggressively
const FETCH_TIMEOUT_MS = 3000;
const MIN_CALL_INTERVAL_MS = 1400; // keeps us under ip-api.com's ~45 req/min free-tier cap

export interface GeoIpResult {
  lat: number;
  lon: number;
  country: string | null;
  city: string | null;
}

const cache = new Map<string, { result: GeoIpResult; expiresAt: number }>();
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_CALL_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCallAt = Date.now();
}

/**
 * Optional ip-api.com geolocation lookup (no API key needed on the free tier),
 * gated behind ENABLE_TI_ENRICHMENT alongside the AbuseIPDB check since both are
 * part of the same "resolve + enrich" pipeline. Never throws — resolves to null
 * on any failure so a report submission is never blocked by this lookup.
 */
export async function lookupGeo(ip: string): Promise<GeoIpResult | null> {
  if (!env.ENABLE_TI_ENRICHMENT) {
    return null;
  }

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    await throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,country,city`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const body = (await response.json()) as {
      status?: string;
      lat?: number;
      lon?: number;
      country?: string | null;
      city?: string | null;
    };
    if (body.status !== "success" || typeof body.lat !== "number" || typeof body.lon !== "number") return null;

    const result: GeoIpResult = { lat: body.lat, lon: body.lon, country: body.country ?? null, city: body.city ?? null };
    cache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    return null;
  }
}
