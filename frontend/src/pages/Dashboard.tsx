import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldAlert, Trophy, Users } from "lucide-react";
import type { AnalyticsSummary, Campaign, Organization, ThreatReport } from "@sixsync/shared";
import { getAnalyticsSummary, getCampaigns, getOrgs, getReports } from "../api/client";
import { useWsEvents } from "../api/useWsEvents";
import { ReputationBadge } from "../components/ReputationBadge";
import { ConfidenceMeter } from "../components/ConfidenceMeter";
import { CampaignCard } from "../components/CampaignCard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";

const STATUS_BADGE: Record<string, "muted" | "warning" | "destructive" | "accent"> = {
  REPORTED: "muted",
  CONFIRMED: "warning",
  CRITICAL: "destructive",
  DISPUTED: "accent",
};

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [reports, setReports] = useState<ThreatReport[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    const [r, o, c, s] = await Promise.all([getReports(), getOrgs(), getCampaigns(), getAnalyticsSummary()]);
    setReports(r);
    setOrgs(o);
    setCampaigns(c);
    setSummary(s);
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

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredReports = normalizedQuery
    ? reports.filter((r) =>
        [r.indicator, r.indicatorType, r.resolvedIp, r.attackType, r.mitreTechnique, r.reporter?.name]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(normalizedQuery))
      )
    : reports;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ShieldAlert} label="Total threat reports" value={summary?.totalReports ?? reports.length} />
        <StatCard icon={Users} label="Organizations in network" value={summary?.totalOrgs ?? orgs.length} />
        <StatCard icon={Trophy} label="Coordinated campaigns" value={summary?.totalCampaigns ?? campaigns.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Live Threat Feed</h2>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search IP, domain, URL, hash…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-3">
            {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports yet — be the first to report a threat.</p>}
            {reports.length > 0 && filteredReports.length === 0 && (
              <p className="text-sm text-muted-foreground">No reports match "{query}".</p>
            )}
            {filteredReports.map((r) => (
              <Link key={r.id} to={`/reports/${r.id}`} className="block">
                <Card className="hover:border-primary/40 hover:shadow-glow transition-all">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm truncate">{r.indicator}</span>
                        <Badge variant="outline">{r.indicatorType}</Badge>
                      </div>
                      <Badge variant={STATUS_BADGE[r.status] ?? "muted"}>{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.attackType} · {r.mitreTechnique} · reported by {r.reporter?.name ?? "unknown"}
                    </p>
                    <ConfidenceMeter score={r.confidenceScore ?? 0} status={r.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div>
            <CardTitle className="mb-3 text-base">Org Leaderboard</CardTitle>
            <div className="space-y-2">
              {orgs.map((o, i) => (
                <Card key={o.id}>
                  <CardContent className="flex items-center justify-between gap-2 pt-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{o.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.reportsCount} reports · {o.accuracyPct.toFixed(0)}% accuracy
                        </p>
                      </div>
                    </div>
                    <ReputationBadge reputation={o.reputation} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <CardTitle className="mb-3 text-base">Active Campaigns</CardTitle>
            <div className="space-y-3">
              {campaigns.length === 0 && <p className="text-sm text-muted-foreground">No coordinated campaigns detected yet.</p>}
              {campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
