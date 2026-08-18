import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma";
import { authenticate, currentOrgId } from "../../middleware/auth";
import { broadcast } from "../../ws/broadcast";
import { recordAudit, AUDIT_ACTIONS } from "../audit/audit.service";

const MAX_COMMENT_LENGTH = 2000;

export async function registerCommentRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { body: string } }>(
    "/reports/:id/comments",
    { preHandler: authenticate },
    async (req, reply) => {
      const orgId = currentOrgId(req);
      const body = req.body?.body?.trim();
      if (!body) return reply.code(400).send({ error: "body is required" });
      if (body.length > MAX_COMMENT_LENGTH) {
        return reply.code(400).send({ error: `body exceeds ${MAX_COMMENT_LENGTH} characters` });
      }

      const report = await prisma.threatReport.findUnique({ where: { id: req.params.id } });
      if (!report) return reply.code(404).send({ error: "report not found" });

      const comment = await prisma.reportComment.create({
        data: { threatReportId: report.id, authorOrgId: orgId, body },
        include: { authorOrg: true },
      });

      const payload = {
        id: comment.id,
        threatReportId: comment.threatReportId,
        authorOrgId: comment.authorOrgId,
        authorOrgName: comment.authorOrg.name,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      };

      broadcast({ type: "comment:new", payload });

      recordAudit({
        action: AUDIT_ACTIONS.COMMENT_POSTED,
        actorOrgId: orgId,
        targetType: "ThreatReport",
        targetId: report.id,
        message: `${comment.authorOrg.name} commented on report ${report.indicator}`,
      });

      return reply.code(201).send(payload);
    }
  );

  app.get<{ Params: { id: string } }>("/reports/:id/comments", async (req) => {
    const comments = await prisma.reportComment.findMany({
      where: { threatReportId: req.params.id },
      include: { authorOrg: true },
      orderBy: { createdAt: "asc" },
    });
    return comments.map((c) => ({
      id: c.id,
      threatReportId: c.threatReportId,
      authorOrgId: c.authorOrgId,
      authorOrgName: c.authorOrg.name,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    }));
  });
}
