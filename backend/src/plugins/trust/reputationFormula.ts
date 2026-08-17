export const CONFIRM_WEIGHT = 2;
export const DISPUTE_WEIGHT = 4;
export const PER_REPORT_CAP_MAX = 10;
export const PER_REPORT_CAP_MIN = -20;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function confirmationDelta(type: "CONFIRM" | "DISPUTE", confirmingOrgReputation: number): number {
  const factor = confirmingOrgReputation / 100;
  return type === "CONFIRM" ? CONFIRM_WEIGHT * factor : -DISPUTE_WEIGHT * factor;
}

export interface ReputationUpdateInputs {
  reporterCurrentReputation: number;
  /** All confirmations for the report, ordered oldest first, including the newest one being applied. */
  orderedConfirmations: Array<{ type: "CONFIRM" | "DISPUTE"; confirmingOrgReputation: number }>;
}

export interface ReputationUpdateComputation {
  oldValue: number;
  newValue: number;
  delta: number;
}

/**
 * Caps the total reputation delta attributable to a single report at [-20, +10],
 * then returns only the marginal (not-yet-applied) portion of that cap — i.e. the
 * incremental change caused by the newest confirmation in orderedConfirmations.
 */
export function computeReputationUpdate(inputs: ReputationUpdateInputs): ReputationUpdateComputation {
  const deltas = inputs.orderedConfirmations.map((c) => confirmationDelta(c.type, c.confirmingOrgReputation));
  const rawAfter = deltas.reduce((sum, d) => sum + d, 0);
  const rawBefore = deltas.slice(0, -1).reduce((sum, d) => sum + d, 0);

  const cappedAfter = clamp(rawAfter, PER_REPORT_CAP_MIN, PER_REPORT_CAP_MAX);
  const cappedBefore = clamp(rawBefore, PER_REPORT_CAP_MIN, PER_REPORT_CAP_MAX);
  const incremental = cappedAfter - cappedBefore;

  const oldValue = inputs.reporterCurrentReputation;
  const newValue = clamp(oldValue + incremental, 0, 100);

  return { oldValue, newValue, delta: newValue - oldValue };
}
