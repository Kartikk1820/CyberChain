import { runCampaignCorrelation } from "../plugins/intel/campaign.service";

const SWEEP_INTERVAL_MS = 60_000;

export function startCampaignSweep(): NodeJS.Timeout {
  return setInterval(() => {
    runCampaignCorrelation().catch((err) => {
      console.error("campaign sweep failed", err);
    });
  }, SWEEP_INTERVAL_MS);
}
