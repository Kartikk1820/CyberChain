export function ReputationBadge({ reputation }: { reputation: number }) {
  const color = reputation >= 80 ? "bg-emerald-500/20 text-emerald-300" : reputation >= 50 ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      ★ {reputation.toFixed(0)}
    </span>
  );
}
