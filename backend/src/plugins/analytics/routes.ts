import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/summary", async () => {
    const [totalReports, totalOrgs, totalCampaigns, statusGroups, attackTypeGroups, mitreGroups, topOrgs, recentReports] =
      await Promise.all([
        prisma.threatReport.count(),
        prisma.organization.count(),
        prisma.campaign.count(),
        prisma.threatReport.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.threatReport.groupBy({
          by: ["attackType"],
          _count: { _all: true },
          orderBy: { _count: { attackType: "desc" } },
          take: 10,
        }),
        prisma.threatReport.groupBy({
          by: ["mitreTechnique"],
          _count: { _all: true },
          orderBy: { _count: { mitreTechnique: "desc" } },
          take: 10,
        }),
        prisma.organization.findMany({
          orderBy: { reportsCount: "desc" },
          take: 8,
          select: { name: true, reportsCount: true, reputation: true },
        }),
        prisma.threatReport.findMany({
          where: { createdAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) } },
          select: { createdAt: true },
        }),
      ]);

    const dayBuckets = new Map<string, number>();
    for (const r of recentReports) {
      const day = r.createdAt.toISOString().slice(0, 10);
      dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
    }
    const reportsByDay = [...dayBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totalReports,
      totalOrgs,
      totalCampaigns,
      statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      attackTypeBreakdown: attackTypeGroups.map((g) => ({ attackType: g.attackType, count: g._count._all })),
      mitreBreakdown: mitreGroups.map((g) => ({ mitreTechnique: g.mitreTechnique, count: g._count._all })),
      reportsByDay,
      topOrgs: topOrgs.map((o) => ({ name: o.name, reportsCount: o.reportsCount, reputation: o.reputation })),
    };
  });
}
