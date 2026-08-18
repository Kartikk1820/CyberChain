import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuditLogEntry } from "@sixsync/shared";
import { getAuditLog } from "../api/client";
import { useWsEvents } from "../api/useWsEvents";

const ACTION_STYLE: Record<string, { label: string; className: string }> = {
  ORG_REGISTERED: { label: "org registered", className: "bg-primary/15 text-primary" },
  ORG_LOGIN: { label: "login", className: "bg-secondary text-muted-foreground" },
  REPORT_SUBMITTED: { label: "report submitted", className: "bg-primary/15 text-primary" },
  REPORT_CONFIRMED: { label: "confirmed", className: "bg-amber-500/20 text-amber-300" },
  REPORT_DISPUTED: { label: "disputed", className: "bg-purple-500/20 text-purple-300" },
  TAMPER_SIMULATED: { label: "tamper simulated", className: "bg-red-500/20 text-red-300" },
  CAMPAIGN_DETECTED: { label: "campaign detected", className: "bg-purple-500/20 text-purple-300" },
  ATTACHMENT_UPLOADED: { label: "attachment uploaded", className: "bg-primary/15 text-primary" },
  ALERT_EMAIL_SENT: { label: "alert email", className: "bg-emerald-500/20 text-emerald-300" },
};

function targetHref(entry: AuditLogEntry): string | null {
  if (entry.targetType === "ThreatReport" && entry.targetId) return `/reports/${entry.targetId}`;
  if (entry.targetType === "Campaign" && entry.targetId) return `/campaigns/${entry.targetId}`;
  return null;
}

export function AuditTrail() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getAuditLog({ limit: 200 });
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWsEvents((event) => {
    if (
      event.type === "report:new" ||
      event.type === "confirmation:new" ||
      event.type === "campaign:new" ||
      event.type === "tamper:detected"
    ) {
      refresh();
    }
  });

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">
          Who did what, when — every registration, confirmation, dispute, tamper simulation, campaign detection, and alert.
        </p>
      </div>

      {entries.length === 0 && <p className="text-sm text-muted-foreground">No audit activity yet.</p>}

      <div className="space-y-2">
        {entries.map((entry) => {
          const style = ACTION_STYLE[entry.action] ?? { label: entry.action, className: "bg-secondary text-muted-foreground" };
          const href = targetHref(entry);
          const content = (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${style.className}`}>{style.label}</span>
                  {entry.actorOrgName && <span className="text-sm text-foreground/90">{entry.actorOrgName}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">{entry.message}</p>
            </>
          );

          return href ? (
            <Link
              key={entry.id}
              to={href}
              className="block rounded-lg border border-border bg-card/60 p-3 hover:border-primary/40 transition-colors"
            >
              {content}
            </Link>
          ) : (
            <div key={entry.id} className="rounded-lg border border-border bg-card/60 p-3">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AuditTrail;
