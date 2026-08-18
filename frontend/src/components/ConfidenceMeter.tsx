import { Progress } from "./ui/progress";

const STATUS_INDICATOR: Record<string, string> = {
  REPORTED: "bg-slate-400",
  CONFIRMED: "bg-amber-400",
  CRITICAL: "bg-red-400",
  DISPUTED: "bg-purple-400",
};

export function ConfidenceMeter({ score, status }: { score: number; status?: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const indicatorClass = status ? (STATUS_INDICATOR[status] ?? "bg-primary") : "bg-primary";
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
        <span>Threat Confidence</span>
        <span className="font-medium text-foreground">{clamped.toFixed(0)}%</span>
      </div>
      <Progress value={clamped} indicatorClassName={indicatorClass} className="h-1.5" />
    </div>
  );
}
