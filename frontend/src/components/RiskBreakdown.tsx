import type { RiskBreakdown as RiskBreakdownType, AccessDecision } from "@sixsync/shared";

const DECISION_STYLE: Record<AccessDecision, string> = {
  ALLOW: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  MFA: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  RESTRICT: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  BLOCK: "bg-red-500/20 text-red-300 border-red-500/40",
};

const ROWS: Array<{ key: keyof RiskBreakdownType; label: string; weight: string }> = [
  { key: "identityRisk", label: "Identity", weight: "20%" },
  { key: "deviceRisk", label: "Device", weight: "15%" },
  { key: "locationRisk", label: "Location", weight: "15%" },
  { key: "ipThreatRisk", label: "IP Threat Feed", weight: "35%" },
  { key: "behaviorRisk", label: "Behavior", weight: "15%" },
];

export function RiskBreakdown({ breakdown, decision, policyApplied }: { breakdown: RiskBreakdownType; decision?: AccessDecision; policyApplied?: string | null }) {
  return (
    <div className="space-y-3">
      {decision && (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${DECISION_STYLE[decision]}`}>
          {decision}
        </div>
      )}
      <div className="space-y-2">
        {ROWS.map((row) => {
          const value = breakdown[row.key];
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                <span>{row.label} <span className="text-muted-foreground/70">({row.weight})</span></span>
                <span>{value.toFixed(0)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full ${value >= 75 ? "bg-red-500" : value >= 40 ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm font-medium text-foreground pt-1 border-t border-border">
        <span>Total Risk Score</span>
        <span>{breakdown.totalRiskScore.toFixed(1)}</span>
      </div>
      {policyApplied && <p className="text-xs text-muted-foreground">Policy: {policyApplied}</p>}
    </div>
  );
}
