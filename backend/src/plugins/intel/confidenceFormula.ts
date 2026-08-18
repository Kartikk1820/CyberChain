import type { ReportStatus } from "@sixsync/shared";

export const FRESHNESS_HALF_LIFE_HOURS = 72;
const LAMBDA = Math.LN2 / FRESHNESS_HALF_LIFE_HOURS;

export const INDICATOR_FORMAT: Record<string, RegExp> = {
  IP: /^(\d{1,3}\.){3}\d{1,3}$/,
  DOMAIN: /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i,
  HASH: /^[a-f0-9]{32,64}$/i,
  URL: /^https?:\/\/.+/i,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function evidenceQuality(hasEvidence: boolean, indicatorFormatValid: boolean, descriptionLength: number): number {
  let score = 0;
  if (hasEvidence) score += 40;
  if (indicatorFormatValid) score += 30;
  if (descriptionLength >= 50) score += 30;
  return clamp(score, 0, 100);
}

export function freshness(ageHours: number): number {
  return 100 * Math.exp(-LAMBDA * Math.max(ageHours, 0));
}

export interface ConfirmationInput {
  type: "CONFIRM" | "DISPUTE";
  confirmingOrgId: string;
  confirmingOrgReputation: number;
}

export interface ConfidenceInputs {
  reporterReputation: number;
  evidenceScore: number;
  aiConfidence: number;
  ageHours: number;
  confirmations: ConfirmationInput[];
  currentStatus: ReportStatus;
}

export const CONFIDENCE_WEIGHTS = {
  reputation: 0.25,
  evidence: 0.15,
  aiConfidence: 0.15,
  confirmation: 0.3,
  freshness: 0.15,
};

export interface ConfidenceBreakdown {
  reporterReputation: number;
  evidenceScore: number;
  aiConfidence: number;
  freshness: number;
  confirmationScore: number;
  disputePenalty: number;
  weights: typeof CONFIDENCE_WEIGHTS;
}

export interface ConfidenceComputation {
  score: number;
  status: ReportStatus;
  distinctConfirmers: number;
  confirmationNet: number;
  breakdown: ConfidenceBreakdown;
}

export function computeConfidence(inputs: ConfidenceInputs): ConfidenceComputation {
  const R = inputs.reporterReputation;
  const E = inputs.evidenceScore;
  const A = inputs.aiConfidence;
  const F = freshness(inputs.ageHours);

  const confirmationNet = inputs.confirmations.reduce((sum, c) => {
    const factor = c.confirmingOrgReputation / 100;
    return sum + (c.type === "CONFIRM" ? factor : -factor);
  }, 0);

  const confirmationScore = 100 * (1 - Math.exp(-0.4 * Math.max(confirmationNet, 0)));
  const disputePenalty = 60 * (1 - Math.exp(-0.4 * Math.max(-confirmationNet, 0)));

  const rawScore =
    CONFIDENCE_WEIGHTS.reputation * R +
    CONFIDENCE_WEIGHTS.evidence * E +
    CONFIDENCE_WEIGHTS.aiConfidence * A +
    CONFIDENCE_WEIGHTS.confirmation * confirmationScore +
    CONFIDENCE_WEIGHTS.freshness * F -
    disputePenalty;
  const score = clamp(rawScore, 0, 100);

  const distinctConfirmers = new Set(
    inputs.confirmations.filter((c) => c.type === "CONFIRM").map((c) => c.confirmingOrgId)
  ).size;

  const hasHighRepDispute = inputs.confirmations.some((c) => c.type === "DISPUTE" && c.confirmingOrgReputation >= 50);

  let status: ReportStatus = "REPORTED";
  if (distinctConfirmers >= 2 && score >= 75) {
    status = "CRITICAL";
  } else if (distinctConfirmers >= 1 && score >= 40) {
    status = "CONFIRMED";
  }
  if (confirmationNet < 0 && hasHighRepDispute) {
    status = "DISPUTED";
  }

  return {
    score,
    status,
    distinctConfirmers,
    confirmationNet,
    breakdown: { reporterReputation: R, evidenceScore: E, aiConfidence: A, freshness: F, confirmationScore, disputePenalty, weights: CONFIDENCE_WEIGHTS },
  };
}
