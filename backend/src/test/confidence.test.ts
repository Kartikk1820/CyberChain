import { test } from "node:test";
import assert from "node:assert/strict";
import { computeConfidence, evidenceQuality, freshness } from "../plugins/intel/confidenceFormula";

test("evidenceQuality rewards evidence, valid format, and a substantial description", () => {
  assert.equal(evidenceQuality(true, true, 60), 100);
  assert.equal(evidenceQuality(false, false, 0), 0);
  assert.equal(evidenceQuality(true, false, 0), 40);
});

test("freshness decays toward zero as age grows past the 72h half-life", () => {
  assert.equal(freshness(0), 100);
  assert.ok(Math.abs(freshness(72) - 50) < 0.01);
  assert.ok(freshness(720) < 1);
});

test("a fresh report with no confirmations stays REPORTED even with a strong reporter", () => {
  const result = computeConfidence({
    reporterReputation: 100,
    evidenceScore: 100,
    aiConfidence: 90,
    ageHours: 0,
    currentStatus: "REPORTED",
    confirmations: [],
  });
  assert.equal(result.status, "REPORTED");
  assert.equal(result.distinctConfirmers, 0);
});

test("one confirmation from a reputable org escalates status to CONFIRMED", () => {
  const result = computeConfidence({
    reporterReputation: 90,
    evidenceScore: 100,
    aiConfidence: 80,
    ageHours: 1,
    currentStatus: "REPORTED",
    confirmations: [{ type: "CONFIRM", confirmingOrgId: "org-2", confirmingOrgReputation: 100 }],
  });
  assert.equal(result.status, "CONFIRMED");
  assert.equal(result.distinctConfirmers, 1);
  assert.ok(result.score >= 40);
});

test("two confirmations from reputable orgs on strong evidence escalate to CRITICAL", () => {
  const result = computeConfidence({
    reporterReputation: 100,
    evidenceScore: 100,
    aiConfidence: 90,
    ageHours: 0,
    currentStatus: "REPORTED",
    confirmations: [
      { type: "CONFIRM", confirmingOrgId: "org-2", confirmingOrgReputation: 100 },
      { type: "CONFIRM", confirmingOrgId: "org-3", confirmingOrgReputation: 100 },
    ],
  });
  assert.equal(result.status, "CRITICAL");
  assert.ok(result.score >= 75);
});

test("a dispute from a reputable org overrides status to DISPUTED", () => {
  const result = computeConfidence({
    reporterReputation: 50,
    evidenceScore: 50,
    aiConfidence: 50,
    ageHours: 1,
    currentStatus: "REPORTED",
    confirmations: [{ type: "DISPUTE", confirmingOrgId: "org-2", confirmingOrgReputation: 80 }],
  });
  assert.equal(result.status, "DISPUTED");
  assert.ok(result.confirmationNet < 0);
});

test("a dispute from a low-reputation org does not trigger DISPUTED override", () => {
  const result = computeConfidence({
    reporterReputation: 50,
    evidenceScore: 50,
    aiConfidence: 50,
    ageHours: 1,
    currentStatus: "REPORTED",
    confirmations: [{ type: "DISPUTE", confirmingOrgId: "org-2", confirmingOrgReputation: 10 }],
  });
  assert.notEqual(result.status, "DISPUTED");
});

test("score is always clamped within [0, 100]", () => {
  const high = computeConfidence({
    reporterReputation: 100,
    evidenceScore: 100,
    aiConfidence: 100,
    ageHours: 0,
    currentStatus: "REPORTED",
    confirmations: Array.from({ length: 10 }, (_, i) => ({
      type: "CONFIRM" as const,
      confirmingOrgId: `org-${i}`,
      confirmingOrgReputation: 100,
    })),
  });
  assert.ok(high.score <= 100);

  const low = computeConfidence({
    reporterReputation: 0,
    evidenceScore: 0,
    aiConfidence: 0,
    ageHours: 100000,
    currentStatus: "REPORTED",
    confirmations: Array.from({ length: 10 }, (_, i) => ({
      type: "DISPUTE" as const,
      confirmingOrgId: `org-${i}`,
      confirmingOrgReputation: 100,
    })),
  });
  assert.ok(low.score >= 0);
});
