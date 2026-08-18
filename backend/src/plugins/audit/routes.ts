import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma";

export async function registerAuditRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { limit?: string; orgId?: string; action?: string } }>("/audit", async (req) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const entries = await prisma.auditLog.findMany({
      where: {
        actorOrgId: req.query.orgId || undefined,
        action: req.query.action || undefined,
      },
      include: { actorOrg: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return entries.map((e) => ({
      id: e.id,
      action: e.action,
      actorOrgId: e.actorOrgId,
      actorOrgName: e.actorOrg?.name ?? null,
      targetType: e.targetType,
      targetId: e.targetId,
      message: e.message,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    }));
  });
}
