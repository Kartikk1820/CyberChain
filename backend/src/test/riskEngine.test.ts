import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDecision, DEFAULT_POLICY_RULES } from "../plugins/defense/policy.service";
import type { RiskBreakdown } from "@sixsync/shared";

function breakdown(overrides: Partial<RiskBreakdown> = {}): RiskBreakdown {
  return {
    identityRisk: 10,
    deviceRisk: 5,
    locationRisk: 5,
    ipThreatRisk: 0,
    behaviorRisk: 10,
    totalRiskScore: 10,
    ...overrides,
  };
}

test("low total risk score is ALLOW", () => {
  const result = evaluateDecision(DEFAULT_POLICY_RULES, breakdown({ totalRiskScore: 10 }));
  assert.equal(result.decision, "ALLOW");
});

test("score at the allow threshold escalates to MFA", () => {
  const result = evaluateDecision(DEFAULT_POLICY_RULES, breakdown({ totalRiskScore: 25 }));
  assert.equal(result.decision, "MFA");
});

test("score at the mfa threshold escalates to RESTRICT", () => {
  const result = evaluateDecision(DEFAULT_POLICY_RULES, breakdown({ totalRiskScore: 50 }));
  assert.equal(result.decision, "RESTRICT");
});

test("score at the restrict threshold escalates to BLOCK", () => {
  const result = evaluateDecision(DEFAULT_POLICY_RULES, breakdown({ totalRiskScore: 75 }));
  assert.equal(result.decision, "BLOCK");
});

test("a high-confidence known-malicious IP forces BLOCK via override regardless of total score", () => {
  const result = evaluateDecision(DEFAULT_POLICY_RULES, breakdown({ totalRiskScore: 5, ipThreatRisk: 95 }));
  assert.equal(result.decision, "BLOCK");
  assert.match(result.policyApplied, /override/);
});

test("an ipThreatRisk just under the override threshold falls through to the normal threshold table", () => {
  const result = evaluateDecision(DEFAULT_POLICY_RULES, breakdown({ totalRiskScore: 5, ipThreatRisk: 89 }));
  assert.equal(result.decision, "ALLOW");
});

test("custom per-org thresholds are respected", () => {
  const strict = {
    thresholds: { allow: 10, mfa: 20, restrict: 30 },
    overrides: [],
  };
  const result = evaluateDecision(strict, breakdown({ totalRiskScore: 15 }));
  assert.equal(result.decision, "MFA");
});

test("an unparseable override condition is safely ignored, not treated as a match", () => {
  const rules = {
    thresholds: { allow: 25, mfa: 50, restrict: 75 },
    overrides: [{ if: "not a real condition", then: "BLOCK" as const, reason: "malformed" }],
  };
  const result = evaluateDecision(rules, breakdown({ totalRiskScore: 10 }));
  assert.equal(result.decision, "ALLOW");
});
