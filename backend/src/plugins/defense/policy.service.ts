import { prisma } from "../../db/prisma";
import type { AccessDecision, RiskBreakdown, SecurityPolicyRules } from "@sixsync/shared";

export const DEFAULT_POLICY_RULES: SecurityPolicyRules = {
  thresholds: { allow: 25, mfa: 50, restrict: 75 },
  overrides: [{ if: "ipThreatRisk >= 90", then: "BLOCK", reason: "high-confidence known-malicious IP" }],
};

const CONDITION_PATTERN = /^\s*(\w+)\s*(>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)\s*$/;

function evaluateCondition(condition: string, breakdown: RiskBreakdown): boolean {
  const match = CONDITION_PATTERN.exec(condition);
  if (!match) return false;
  const [, field, op, valueStr] = match;
  const fieldValue = (breakdown as unknown as Record<string, number>)[field];
  if (typeof fieldValue !== "number") return false;
  const threshold = Number(valueStr);

  switch (op) {
    case ">=":
      return fieldValue >= threshold;
    case "<=":
      return fieldValue <= threshold;
    case ">":
      return fieldValue > threshold;
    case "<":
      return fieldValue < threshold;
    case "==":
      return fieldValue === threshold;
    default:
      return false;
  }
}

export interface DecisionResult {
  decision: AccessDecision;
  policyApplied: string;
}

export function evaluateDecision(rules: SecurityPolicyRules, breakdown: RiskBreakdown): DecisionResult {
  for (const override of rules.overrides) {
    if (evaluateCondition(override.if, breakdown)) {
      return { decision: override.then, policyApplied: `override: ${override.if} (${override.reason})` };
    }
  }

  const { totalRiskScore } = breakdown;
  const { allow, mfa, restrict } = rules.thresholds;

  if (totalRiskScore < allow) return { decision: "ALLOW", policyApplied: `threshold: score < ${allow}` };
  if (totalRiskScore < mfa) return { decision: "MFA", policyApplied: `threshold: ${allow} <= score < ${mfa}` };
  if (totalRiskScore < restrict) return { decision: "RESTRICT", policyApplied: `threshold: ${mfa} <= score < ${restrict}` };
  return { decision: "BLOCK", policyApplied: `threshold: score >= ${restrict}` };
}

export async function getPolicyRules(organizationId: string): Promise<SecurityPolicyRules> {
  const policy = await prisma.securityPolicy.findUnique({ where: { organizationId } });
  if (!policy) return DEFAULT_POLICY_RULES;
  return policy.rules as unknown as SecurityPolicyRules;
}

export async function upsertPolicyRules(organizationId: string, rules: SecurityPolicyRules): Promise<SecurityPolicyRules> {
  const updated = await prisma.securityPolicy.upsert({
    where: { organizationId },
    create: { organizationId, rules: rules as any },
    update: { rules: rules as any },
  });
  return updated.rules as unknown as SecurityPolicyRules;
}
