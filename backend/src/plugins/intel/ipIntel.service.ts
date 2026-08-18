import type { IndicatorType } from "@sixsync/shared";
import { resolveIndicatorToIp } from "./dnsResolution";
import { checkIp } from "./abuseIpdbClient";
import { lookupGeo } from "./geoIpClient";

export interface IpIntelResult {
  resolvedIp: string | null;
  geoLat: number | null;
  geoLon: number | null;
  geoCountry: string | null;
  geoCity: string | null;
  abuseScore: number | null;
}

const EMPTY_RESULT: IpIntelResult = {
  resolvedIp: null,
  geoLat: null,
  geoLon: null,
  geoCountry: null,
  geoCity: null,
  abuseScore: null,
};

/**
 * Resolves a threat indicator to an IP (if it isn't one already) and enriches
 * it with a live abuse score + geolocation. Every step underneath is already
 * gated/timeout-safe/non-throwing, so this never blocks report submission.
 */
export async function enrichIndicatorWithIp(indicator: string, indicatorType: IndicatorType): Promise<IpIntelResult> {
  const { ip } = await resolveIndicatorToIp(indicator, indicatorType);
  if (!ip) {
    return EMPTY_RESULT;
  }

  const [abuse, geo] = await Promise.all([checkIp(ip), lookupGeo(ip)]);

  return {
    resolvedIp: ip,
    geoLat: geo?.lat ?? null,
    geoLon: geo?.lon ?? null,
    geoCountry: geo?.country ?? null,
    geoCity: geo?.city ?? null,
    abuseScore: abuse?.abuseScore ?? null,
  };
}
