const STATUS_STYLE: Record<string, string> = {
  REPORTED: "bg-slate-500",
  CONFIRMED: "bg-amber-500",
  CRITICAL: "bg-red-500",
  DISPUTED: "bg-purple-500",
};

export function ConfidenceMeter({ score, status }: { score: number; status?: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const barColor = status ? (STATUS_STYLE[status] ?? "bg-sky-500") : "bg-sky-500";
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>Threat Confidence</span>
        <span>{clamped.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
