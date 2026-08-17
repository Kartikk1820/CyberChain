import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReputationUpdate } from "../plugins/trust/reputationFormula";

test("a single confirmation from a full-reputation org adds +2", () => {
  const result = computeReputationUpdate({
    reporterCurrentReputation: 80,
    orderedConfirmations: [{ type: "CONFIRM", confirmingOrgReputation: 100 }],
  });
  assert.equal(result.delta, 2);
  assert.equal(result.newValue, 82);
});

test("a single dispute from a full-reputation org subtracts -4 (disputes hurt 2x confirms)", () => {
  const result = computeReputationUpdate({
    reporterCurrentReputation: 80,
    orderedConfirmations: [{ type: "DISPUTE", confirmingOrgReputation: 100 }],
  });
  assert.equal(result.delta, -4);
  assert.equal(result.newValue, 76);
});

test("a confirmation from a lower-reputation org is scaled down proportionally", () => {
  const result = computeReputationUpdate({
    reporterCurrentReputation: 80,
    orderedConfirmations: [{ type: "CONFIRM", confirmingOrgReputation: 50 }],
  });
  assert.equal(result.delta, 1); // 2 * (50/100)
});

test("cumulative positive delta from one report is capped at +10", () => {
  // 6 confirmations at +2 each would raw-sum to +12, but the per-report cap is +10.
  const confirmations = Array.from({ length: 6 }, () => ({ type: "CONFIRM" as const, confirmingOrgReputation: 100 }));

  // Apply incrementally, one at a time, mirroring how the route calls this after each new confirmation.
  let reputation = 50;
  let totalDelta = 0;
  for (let i = 1; i <= confirmations.length; i++) {
    const result = computeReputationUpdate({
      reporterCurrentReputation: reputation,
      orderedConfirmations: confirmations.slice(0, i),
    });
    reputation = result.newValue;
    totalDelta += result.delta;
  }

  assert.equal(totalDelta, 10);
  assert.equal(reputation, 60);
});

test("cumulative negative delta from one report is capped at -20", () => {
  const disputes = Array.from({ length: 6 }, () => ({ type: "DISPUTE" as const, confirmingOrgReputation: 100 }));

  let reputation = 50;
  let totalDelta = 0;
  for (let i = 1; i <= disputes.length; i++) {
    const result = computeReputationUpdate({
      reporterCurrentReputation: reputation,
      orderedConfirmations: disputes.slice(0, i),
    });
    reputation = result.newValue;
    totalDelta += result.delta;
  }

  assert.equal(totalDelta, -20);
  assert.equal(reputation, 30);
});

test("reputation is clamped to [0, 100] even beyond the per-report cap", () => {
  const disputes = Array.from({ length: 10 }, () => ({ type: "DISPUTE" as const, confirmingOrgReputation: 100 }));

  let reputation = 5;
  for (let i = 1; i <= disputes.length; i++) {
    const result = computeReputationUpdate({
      reporterCurrentReputation: reputation,
      orderedConfirmations: disputes.slice(0, i),
    });
    reputation = result.newValue;
  }

  assert.equal(reputation, 0);
});

test("mixed confirm/dispute nets out and stays within the report cap", () => {
  const events = [
    { type: "CONFIRM" as const, confirmingOrgReputation: 100 },
    { type: "CONFIRM" as const, confirmingOrgReputation: 100 },
    { type: "DISPUTE" as const, confirmingOrgReputation: 100 },
  ];

  let reputation = 70;
  for (let i = 1; i <= events.length; i++) {
    const result = computeReputationUpdate({
      reporterCurrentReputation: reputation,
      orderedConfirmations: events.slice(0, i),
    });
    reputation = result.newValue;
  }

  // +2, +2, then a dispute nets the cumulative report delta back to 0 → net back to the start
  assert.equal(reputation, 70);
});
