import type { Campaign } from "@sixsync/shared";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-purple-300">⚠ {campaign.name}</h3>
        <span className="text-xs text-purple-400">{campaign.confidence.toFixed(0)}% confidence</span>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {campaign.commonTechniques.map((t) => (
          <span key={t} className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[11px] text-purple-200">
            {t}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {campaign.indicatorCount ?? 0} indicators · {campaign.orgCount ?? 0} orgs · detected {new Date(campaign.detectedAt).toLocaleString()}
      </p>
    </div>
  );
}
