import { useCallback, useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { ThreatReport } from "@sixsync/shared";
import { getThreatFeed, type ThreatFeedItem } from "../api/client";
import { useWsEvents } from "../api/useWsEvents";

const STATUS_COLOR: Record<string, string> = {
  REPORTED: "#64748b",
  CONFIRMED: "#f59e0b",
  CRITICAL: "#ef4444",
  DISPUTED: "#a855f7",
};

type GeoPoint = ThreatFeedItem & { geoLat: number; geoLon: number };

function hasGeo(item: ThreatFeedItem): item is GeoPoint {
  return item.geoLat !== null && item.geoLon !== null;
}

function reportToGeoPoint(report: ThreatReport): GeoPoint | null {
  if (report.geoLat == null || report.geoLon == null) return null;
  return {
    id: report.id,
    indicator: report.indicator,
    indicatorType: report.indicatorType,
    attackType: report.attackType,
    mitreTechnique: report.mitreTechnique,
    severity: report.severity,
    status: report.status,
    confidence: report.confidenceScore ?? 0,
    reporterOrgName: report.reporter?.name ?? "unknown",
    createdAt: report.createdAt,
    resolvedIp: report.resolvedIp ?? null,
    geoLat: report.geoLat,
    geoLon: report.geoLon,
    geoCountry: report.geoCountry ?? null,
    geoCity: report.geoCity ?? null,
    abuseScore: report.abuseScore ?? null,
  };
}

export function ThreatGlobe() {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const refresh = useCallback(async () => {
    const feed = await getThreatFeed();
    setPoints(feed.filter(hasGeo));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: 600 });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: 600 });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
    }
  }, [loading]);

  useWsEvents((event) => {
    if (event.type === "report:new") {
      const point = reportToGeoPoint(event.payload);
      if (point) {
        setPoints((prev) => [...prev, point]);
      }
      return;
    }
    if (event.type === "report:updated" || event.type === "confirmation:new") {
      refresh();
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Threat Globe</h2>
        <p className="text-xs text-muted-foreground">Live geographic view of confirmed/critical threat indicators.</p>
      </div>
      <div ref={containerRef} className="rounded-lg border border-border bg-card/60 p-2 overflow-hidden">
        {loading && <p className="text-muted-foreground text-sm p-4">Loading…</p>}
        {!loading && points.length === 0 && (
          <p className="text-muted-foreground text-sm p-4">No geolocated threats yet — reports need a resolvable IP and threat-intel enrichment enabled.</p>
        )}
        {!loading && points.length > 0 && (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            pointsData={points}
            pointLat="geoLat"
            pointLng="geoLon"
            pointColor={(d) => STATUS_COLOR[(d as GeoPoint).status] ?? "#64748b"}
            pointRadius={(d) => 0.3 + ((d as GeoPoint).abuseScore ?? 0) / 200}
            pointAltitude={0.01}
            pointLabel={(d) => {
              const p = d as GeoPoint;
              return `<div style="background:#0a0e1a;border:1px solid #1d2333;border-radius:8px;padding:6px 8px;font-size:12px;color:#e2e8f0">
                <strong>${p.indicator}</strong> (${p.indicatorType})<br/>
                ${p.geoCity ? `${p.geoCity}, ` : ""}${p.geoCountry ?? "unknown location"}<br/>
                abuse score: ${p.abuseScore ?? "n/a"} · reported by ${p.reporterOrgName}
              </div>`;
            }}
          />
        )}
      </div>
    </div>
  );
}

export default ThreatGlobe;
