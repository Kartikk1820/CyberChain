import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma";
import { authenticate, currentOrgId } from "../../middleware/auth";
import { broadcast } from "../../ws/broadcast";
import { computeRiskBreakdown } from "./riskEngine";
import { evaluateDecision, getPolicyRules, upsertPolicyRules } from "./policy.service";
import type { SecurityPolicyRules } from "@sixsync/shared";

export async function registerDefenseRoutes(app: FastifyInstance) {
  app.post<{ Body: { user: string; ip: string; deviceFingerprint: string; passwordValid: boolean } }>(
    "/access-attempts",
    { preHandler: authenticate },
    async (req, reply) => {
      const organizationId = currentOrgId(req);
      const { user, ip, deviceFingerprint, passwordValid } = req.body ?? {};
      if (!user || !ip || !deviceFingerprint || typeof passwordValid !== "boolean") {
        return reply.code(400).send({ error: "user, ip, deviceFingerprint, passwordValid are required" });
      }

      const breakdown = await computeRiskBreakdown({ organizationId, user, ip, deviceFingerprint, passwordValid });
      const rules = await getPolicyRules(organizationId);
      const { decision, policyApplied } = evaluateDecision(rules, breakdown);

      const attempt = await prisma.accessAttempt.create({
        data: {
          user,
          organizationId,
          ip,
          deviceFingerprint,
          passwordValid,
          identityRisk: breakdown.identityRisk,
          deviceRisk: breakdown.deviceRisk,
          locationRisk: breakdown.locationRisk,
          ipThreatRisk: breakdown.ipThreatRisk,
          behaviorRisk: breakdown.behaviorRisk,
          totalRiskScore: breakdown.totalRiskScore,
          decision,
          policyApplied,
        },
      });

      broadcast({
        type: "access_attempt:new",
        payload: {
          id: attempt.id,
          user: attempt.user,
          organizationId: attempt.organizationId,
          ip: attempt.ip,
          deviceFingerprint: attempt.deviceFingerprint,
          passwordValid: attempt.passwordValid,
          identityRisk: attempt.identityRisk,
          deviceRisk: attempt.deviceRisk,
          locationRisk: attempt.locationRisk,
          ipThreatRisk: attempt.ipThreatRisk,
          behaviorRisk: attempt.behaviorRisk,
          totalRiskScore: attempt.totalRiskScore,
          decision: attempt.decision,
          policyApplied: attempt.policyApplied,
          createdAt: attempt.createdAt.toISOString(),
        },
      });

      return reply.code(201).send(attempt);
    }
  );

  app.get("/access-attempts", { preHandler: authenticate }, async (req) => {
    const organizationId = currentOrgId(req);
    return prisma.accessAttempt.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100 });
  });

  app.get("/policies", { preHandler: authenticate }, async (req) => {
    return getPolicyRules(currentOrgId(req));
  });

  app.put<{ Body: SecurityPolicyRules }>("/policies", { preHandler: authenticate }, async (req, reply) => {
    const rules = req.body;
    if (!rules?.thresholds || !Array.isArray(rules.overrides)) {
      return reply.code(400).send({ error: "thresholds and overrides are required" });
    }
    return upsertPolicyRules(currentOrgId(req), rules);
  });
}
