import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import type { CampaignDetail as CampaignDetailType } from "@sixsync/shared";
import { getCampaignDetail } from "../api/client";
import { useWsEvents } from "../api/useWsEvents";
import { ReputationBadge } from "../components/ReputationBadge";
import { ConfidenceMeter } from "../components/ConfidenceMeter";
import { Badge } from "../components/ui/badge";

const STATUS_DOT: Record<string, string> = {
  REPORTED: "bg-slate-500",
  CONFIRMED: "bg-amber-500",
  CRITICAL: "bg-red-500",
  DISPUTED: "bg-purple-500",
};

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetailType | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await getCampaignDetail(id);
      setCampaign(detail);
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWsEvents((event) => {
    if ((event.type === "campaign:updated" || event.type === "campaign:new") && event.payload.id === id) {
      refresh();
    }
  });

  if (notFound) return <p className="text-muted-foreground text-sm">Campaign not found.</p>;
  if (!campaign) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold text-accent">
            <TriangleAlert className="h-4 w-4" /> {campaign.name}
          </h1>
          <span className="text-sm text-accent/80">{campaign.confidence.toFixed(0)}% confidence</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {campaign.commonTechniques.map((t) => (
            <Badge key={t} variant="accent">
              {t}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          detected {new Date(campaign.detectedAt).toLocaleString()} · last updated {new Date(campaign.updatedAt).toLocaleString()}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Indicators ({campaign.indicators.length})</h2>
        <div className="space-y-2">
          {campaign.indicators.map((r) => (
            <Link
              key={r.id}
              to={`/reports/${r.id}`}
              className="block rounded-lg border border-border bg-card/60 p-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[r.status] ?? "bg-slate-500"}`} />
                  <span className="font-mono text-sm">{r.indicator}</span>
                  <span className="text-xs text-muted-foreground">{r.indicatorType}</span>
                </div>
                <span className="text-xs text-muted-foreground">{r.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {r.attackType} · {r.mitreTechnique} · reported by {r.reporterOrgName}
              </p>
              <ConfidenceMeter score={r.confidence} status={r.status} />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Organizations involved ({campaign.orgs.length})</h2>
        <div className="space-y-2">
          {campaign.orgs.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2">
              <div>
                <p className="text-sm">{o.name}</p>
                <p className="text-xs text-muted-foreground">{o.type}</p>
              </div>
              <ReputationBadge reputation={o.reputation} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CampaignDetail;
