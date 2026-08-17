import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Campaign, Organization, ThreatReport } from "@sixsync/shared";
import { getCampaigns, getOrgs, getReports } from "../api/client";
import { useWsEvents } from "../api/useWsEvents";
import { ReputationBadge } from "../components/ReputationBadge";
import { ConfidenceMeter } from "../components/ConfidenceMeter";
import { CampaignCard } from "../components/CampaignCard";

const STATUS_DOT: Record<string, string> = {
  REPORTED: "bg-slate-500",
  CONFIRMED: "bg-amber-500",
  CRITICAL: "bg-red-500",
  DISPUTED: "bg-purple-500",
};

export function Dashboard() {
  const [reports, setReports] = useState<ThreatReport[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [r, o, c] = await Promise.all([getReports(), getOrgs(), getCampaigns()]);
    setReports(r);
    setOrgs(o);
    setCampaigns(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWsEvents((event) => {
    if (
      event.type === "report:new" ||
      event.type === "report:updated" ||
      event.type === "confirmation:new" ||
      event.type === "reputation:updated" ||
      event.type === "campaign:new" ||
      event.type === "campaign:updated"
    ) {
      refresh();
    }
  });

  if (loading) return <p className="text-slate-500 text-sm">Loading…</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 space-y-4">
        <h2 className="text-lg font-semibold">Live Threat Feed</h2>
        <div className="space-y-3">
          {reports.length === 0 && <p className="text-sm text-slate-500">No reports yet — be the first to report a threat.</p>}
          {reports.map((r) => (
            <Link
              key={r.id}
              to={`/reports/${r.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[r.status] ?? "bg-slate-500"}`} />
                  <span className="font-mono text-sm">{r.indicator}</span>
                  <span className="text-xs text-slate-500">{r.indicatorType}</span>
                </div>
                <span className="text-xs text-slate-500">{r.status}</span>
              </div>
              <p className="text-xs text-slate-400 mb-2">
                {r.attackType} · {r.mitreTechnique} · reported by {r.reporter?.name ?? "unknown"}
              </p>
              <ConfidenceMeter score={r.confidenceScore ?? 0} status={r.status} />
            </Link>
          ))}
        </div>
      </section>

      <aside className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Org Leaderboard</h2>
          <div className="space-y-2">
            {orgs.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                <div>
                  <p className="text-sm">{o.name}</p>
                  <p className="text-xs text-slate-500">
                    {o.reportsCount} reports · {o.accuracyPct.toFixed(0)}% accuracy
                  </p>
                </div>
                <ReputationBadge reputation={o.reputation} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Active Campaigns</h2>
          <div className="space-y-3">
            {campaigns.length === 0 && <p className="text-sm text-slate-500">No coordinated campaigns detected yet.</p>}
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
