import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma";
import { authenticate, currentOrgId } from "../../middleware/auth";
import { broadcast } from "../../ws/broadcast";
import { applyReputationUpdate } from "../trust/reputation.service";
import { computeAndPersistConfidence } from "./confidence.service";
import { runCampaignCorrelation } from "./campaign.service";
import { recordAudit, AUDIT_ACTIONS } from "../audit/audit.service";
import type { ConfirmationType } from "@sixsync/shared";

export async function registerIntelRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { type: ConfirmationType; evidenceNote?: string } }>(
    "/reports/:id/confirmations",
    { preHandler: authenticate },
    async (req, reply) => {
      const orgId = currentOrgId(req);
      const { type, evidenceNote } = req.body ?? {};
      if (type !== "CONFIRM" && type !== "DISPUTE") {
        return reply.code(400).send({ error: "type must be CONFIRM or DISPUTE" });
      }

      const report = await prisma.threatReport.findUnique({ where: { id: req.params.id } });
      if (!report) return reply.code(404).send({ error: "report not found" });
      if (report.reporterOrgId === orgId) {
        return reply.code(400).send({ error: "an organization cannot confirm or dispute its own report" });
      }

      const existing = await prisma.confirmation.findUnique({
        where: { threatReportId_confirmingOrgId: { threatReportId: report.id, confirmingOrgId: orgId } },
      });
      if (existing) return reply.code(409).send({ error: "this organization already voted on this report" });

      await prisma.confirmation.create({
        data: { threatReportId: report.id, confirmingOrgId: orgId, type, evidenceNote },
      });

      broadcast({ type: "confirmation:new", payload: { reportId: report.id, confirmingOrgId: orgId, confirmationType: type } });

      recordAudit({
        action: type === "CONFIRM" ? AUDIT_ACTIONS.REPORT_CONFIRMED : AUDIT_ACTIONS.REPORT_DISPUTED,
        actorOrgId: orgId,
        targetType: "ThreatReport",
        targetId: report.id,
        message: `Report ${report.indicator} was ${type === "CONFIRM" ? "confirmed" : "disputed"}${evidenceNote ? `: "${evidenceNote}"` : ""}`,
      });

      const reputationUpdate = await applyReputationUpdate(report.id);
      if (reputationUpdate.delta !== 0) {
        broadcast({
          type: "reputation:updated",
          payload: {
            orgId: reputationUpdate.orgId,
            oldValue: reputationUpdate.oldValue,
            newValue: reputationUpdate.newValue,
            delta: reputationUpdate.delta,
            reason: type === "CONFIRM" ? "report confirmed by another org" : "report disputed by another org",
          },
        });
      }

      const confidence = await computeAndPersistConfidence(report.id);
      broadcast({
        type: "report:updated",
        payload: { reportId: report.id, status: confidence.status, score: confidence.score },
      });

      if (confidence.status === "CONFIRMED" || confidence.status === "CRITICAL") {
        await runCampaignCorrelation();
      }

      return reply.code(201).send({ ...confidence });
    }
  );

  app.get("/threat-feed", async () => {
    const reports = await prisma.threatReport.findMany({
      where: { status: { in: ["CONFIRMED", "CRITICAL"] } },
      include: { reporter: true, confidenceScore: true },
      orderBy: [{ confidenceScore: { score: "desc" } }],
    });
    return reports.map((r) => ({
      id: r.id,
      indicator: r.indicator,
      indicatorType: r.indicatorType,
      attackType: r.attackType,
      mitreTechnique: r.mitreTechnique,
      severity: r.severity,
      status: r.status,
      confidence: r.confidenceScore?.score ?? 0,
      reporterOrgName: r.reporter.name,
      createdAt: r.createdAt.toISOString(),
      resolvedIp: r.resolvedIp,
      geoLat: r.geoLat,
      geoLon: r.geoLon,
      geoCountry: r.geoCountry,
      geoCity: r.geoCity,
      abuseScore: r.abuseScore,
    }));
  });

  app.get("/campaigns", async () => {
    const campaigns = await prisma.campaign.findMany({
      include: { indicators: true, orgs: true },
      orderBy: { detectedAt: "desc" },
    });
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      commonTechniques: c.commonTechniques,
      confidence: c.confidence,
      detectedAt: c.detectedAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      indicatorCount: c.indicators.length,
      orgCount: c.orgs.length,
    }));
  });

  app.get<{ Params: { id: string } }>("/campaigns/:id", async (req, reply) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        indicators: { include: { threatReport: { include: { reporter: true, confidenceScore: true } } } },
        orgs: { include: { organization: true } },
      },
    });
    if (!campaign) return reply.code(404).send({ error: "campaign not found" });

    return {
      id: campaign.id,
      name: campaign.name,
      commonTechniques: campaign.commonTechniques,
      confidence: campaign.confidence,
      detectedAt: campaign.detectedAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      indicatorCount: campaign.indicators.length,
      orgCount: campaign.orgs.length,
      indicators: campaign.indicators.map((ci) => ({
        id: ci.threatReport.id,
        indicator: ci.threatReport.indicator,
        indicatorType: ci.threatReport.indicatorType,
        attackType: ci.threatReport.attackType,
        mitreTechnique: ci.threatReport.mitreTechnique,
        severity: ci.threatReport.severity,
        status: ci.threatReport.status,
        confidence: ci.threatReport.confidenceScore?.score ?? 0,
        reporterOrgName: ci.threatReport.reporter.name,
        createdAt: ci.threatReport.createdAt.toISOString(),
      })),
      orgs: campaign.orgs.map((co) => ({
        id: co.organization.id,
        name: co.organization.name,
        type: co.organization.type,
        reputation: co.organization.reputation,
      })),
    };
  });
}
