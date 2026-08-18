import { prisma } from "../../db/prisma";
import { broadcast } from "../../ws/broadcast";
import { sendCampaignAlert } from "./emailAlerts";
import { recordAudit, AUDIT_ACTIONS } from "../audit/audit.service";

const CORRELATION_WINDOW_HOURS = 72;
const MIN_DISTINCT_INDICATORS = 3;
const MIN_DISTINCT_ORGS = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function runCampaignCorrelation(): Promise<void> {
  const windowStart = new Date(Date.now() - CORRELATION_WINDOW_HOURS * 60 * 60 * 1000);

  const reports = await prisma.threatReport.findMany({
    where: { status: { in: ["CONFIRMED", "CRITICAL"] }, createdAt: { gte: windowStart } },
    include: { confirmations: true, confidenceScore: true },
  });

  const byTechnique = new Map<string, typeof reports>();
  for (const report of reports) {
    const list = byTechnique.get(report.mitreTechnique) ?? [];
    list.push(report);
    byTechnique.set(report.mitreTechnique, list);
  }

  for (const [technique, members] of byTechnique) {
    const distinctIndicators = new Set(members.map((r) => r.indicator));
    const orgIds = new Set<string>();
    for (const r of members) {
      orgIds.add(r.reporterOrgId);
      for (const c of r.confirmations) if (c.type === "CONFIRM") orgIds.add(c.confirmingOrgId);
    }

    if (distinctIndicators.size < MIN_DISTINCT_INDICATORS || orgIds.size < MIN_DISTINCT_ORGS) continue;

    const avgScore = members.reduce((sum, r) => sum + (r.confidenceScore?.score ?? 0), 0) / members.length;
    const confidence = clamp(avgScore * (1 + 0.05 * Math.min(orgIds.size - 2, 5)), 0, 100);

    const existing = await prisma.campaign.findFirst({
      where: { commonTechniques: { has: technique }, detectedAt: { gte: windowStart } },
      orderBy: { detectedAt: "desc" },
    });

    if (existing) {
      await prisma.$transaction([
        ...members.map((r) =>
          prisma.campaignIndicator.upsert({
            where: { campaignId_threatReportId: { campaignId: existing.id, threatReportId: r.id } },
            create: { campaignId: existing.id, threatReportId: r.id },
            update: {},
          })
        ),
        ...[...orgIds].map((orgId) =>
          prisma.campaignOrg.upsert({
            where: { campaignId_organizationId: { campaignId: existing.id, organizationId: orgId } },
            create: { campaignId: existing.id, organizationId: orgId },
            update: {},
          })
        ),
        prisma.campaign.update({ where: { id: existing.id }, data: { confidence } }),
      ]);

      broadcast({
        type: "campaign:updated",
        payload: {
          id: existing.id,
          name: existing.name,
          commonTechniques: existing.commonTechniques,
          confidence,
          detectedAt: existing.detectedAt.toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      const name = `Coordinated ${technique} activity — ${orgIds.size} orgs`;
      const created = await prisma.campaign.create({
        data: {
          name,
          commonTechniques: [technique],
          confidence,
          indicators: { create: members.map((r) => ({ threatReportId: r.id })) },
          orgs: { create: [...orgIds].map((organizationId) => ({ organizationId })) },
        },
      });

      broadcast({
        type: "campaign:new",
        payload: {
          id: created.id,
          name: created.name,
          commonTechniques: created.commonTechniques,
          confidence: created.confidence,
          detectedAt: created.detectedAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      });

      recordAudit({
        action: AUDIT_ACTIONS.CAMPAIGN_DETECTED,
        actorOrgId: null,
        targetType: "Campaign",
        targetId: created.id,
        message: `New coordinated campaign detected: "${created.name}" across ${orgIds.size} orgs`,
        metadata: { commonTechniques: created.commonTechniques, indicatorCount: members.length },
      });

      sendCampaignAlert(
        { id: created.id, name: created.name, commonTechniques: created.commonTechniques, confidence: created.confidence },
        [...orgIds]
      );
    }
  }
}
