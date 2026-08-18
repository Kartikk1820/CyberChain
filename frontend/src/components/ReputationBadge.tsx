import { Star } from "lucide-react";
import { Badge } from "./ui/badge";

export function ReputationBadge({ reputation }: { reputation: number }) {
  const variant = reputation >= 80 ? "success" : reputation >= 50 ? "warning" : "destructive";
  return (
    <Badge variant={variant}>
      <Star className="h-2.5 w-2.5 fill-current" /> {reputation.toFixed(0)}
    </Badge>
  );
}
