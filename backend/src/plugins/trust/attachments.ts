import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { prisma } from "../../db/prisma";
import { authenticate, currentOrgId } from "../../middleware/auth";
import { recordAudit, AUDIT_ACTIONS } from "../audit/audit.service";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

export async function registerAttachmentRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/reports/:id/attachments",
    { preHandler: authenticate },
    async (req, reply) => {
      const orgId = currentOrgId(req);
      const report = await prisma.threatReport.findUnique({ where: { id: req.params.id } });
      if (!report) return reply.code(404).send({ error: "report not found" });
      if (!req.isMultipart()) return reply.code(400).send({ error: "expected multipart/form-data" });

      const created: { id: string; filename: string; size: number }[] = [];
      for await (const part of req.parts()) {
        if (part.type !== "file") continue;
        const file = part as MultipartFile;
        const buffer = await file.toBuffer();
        if (buffer.length > MAX_ATTACHMENT_BYTES) {
          return reply.code(413).send({ error: `attachment "${sanitizeFilename(file.filename)}" exceeds 8MB limit` });
        }
        const filename = sanitizeFilename(file.filename || "attachment");
        const attachment = await prisma.reportAttachment.create({
          data: {
            threatReportId: report.id,
            filename,
            mimeType: file.mimetype || "application/octet-stream",
            size: buffer.length,
            data: buffer,
            uploadedByOrgId: orgId,
          },
        });
        created.push({ id: attachment.id, filename: attachment.filename, size: attachment.size });
      }

      if (created.length === 0) return reply.code(400).send({ error: "no file part found in request" });

      for (const c of created) {
        recordAudit({
          action: AUDIT_ACTIONS.ATTACHMENT_UPLOADED,
          actorOrgId: orgId,
          targetType: "ThreatReport",
          targetId: report.id,
          message: `Attachment "${c.filename}" (${c.size} bytes) uploaded to report ${report.indicator}`,
        });
      }

      return reply.code(201).send({ attachments: created });
    }
  );

  app.get<{ Params: { id: string } }>("/reports/:id/attachments", async (req) => {
    const attachments = await prisma.reportAttachment.findMany({
      where: { threatReportId: req.params.id },
      include: { uploadedBy: true },
      orderBy: { createdAt: "desc" },
    });
    return attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      uploadedByOrgName: a.uploadedBy.name,
      createdAt: a.createdAt.toISOString(),
    }));
  });

  app.get<{ Params: { id: string } }>("/attachments/:id/download", async (req, reply) => {
    const attachment = await prisma.reportAttachment.findUnique({ where: { id: req.params.id } });
    if (!attachment) return reply.code(404).send({ error: "attachment not found" });
    reply.header("Content-Type", attachment.mimeType);
    reply.header("Content-Disposition", `attachment; filename="${sanitizeFilename(attachment.filename)}"`);
    return reply.send(Buffer.from(attachment.data));
  });
}
