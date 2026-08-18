import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import type { Campaign } from "@sixsync/shared";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link to={`/campaigns/${campaign.id}`} className="block">
      <Card className="border-accent/30 bg-accent/5 hover:border-accent/50 hover:shadow-[0_0_20px_-8px_hsl(var(--accent)/0.5)] transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              {campaign.name}
            </h3>
            <span className="text-xs text-accent/80 shrink-0">{campaign.confidence.toFixed(0)}%</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex flex-wrap gap-1">
            {campaign.commonTechniques.map((t) => (
              <Badge key={t} variant="accent">
                {t}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {campaign.indicatorCount ?? 0} indicators · {campaign.orgCount ?? 0} orgs · detected{" "}
            {new Date(campaign.detectedAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
