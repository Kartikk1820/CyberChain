import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { prisma } from "../../db/prisma";
import { registerOrganization, verifyLogin } from "./identity.service";
import { verifyReportSignature } from "./signature.service";
import { sha256Hex } from "./evidence.service";
import { appendLedgerBlock, getLedgerBlock, verifyLedgerChain } from "./ledgerClient";
import { authenticate, currentOrgId } from "../../middleware/auth";
import { broadcast } from "../../ws/broadcast";
import { canonicalReportPayload, type IndicatorType, type OrgType, type SignableReportFields } from "@sixsync/shared";
import type { Organization } from "@prisma/client";
import { classify } from "../intel/classifier";
import { enrichClassification } from "../intel/llmEnrichment";
import { computeAndPersistConfidence } from "../intel/confidence.service";

function serializeOrg(org: Organization) {
  return {
    id: org.id,
    name: org.name,
    type: org.type as OrgType,
    did: org.did,
    publicKey: org.publicKey,
    reputation: org.reputation,
    reportsCount: org.reportsCount,
    confirmedCount: org.confirmedCount,
    disputedCount: org.disputedCount,
    accuracyPct: org.accuracyPct,
    createdAt: org.createdAt.toISOString(),
  };
}

export async function registerTrustRoutes(app: FastifyInstance) {
  app.post<{ Body: { name: string; type: OrgType; publicKey: string; email: string; password: string } }>(
    "/orgs",
    async (req, reply) => {
      const { name, type, publicKey, email, password } = req.body ?? {};
      if (!name || !type || !publicKey || !email || !password) {
        return reply.code(400).send({ error: "name, type, publicKey, email, password are required" });
      }

      const existing = await prisma.organization.findUnique({ where: { publicKey } });
      if (existing) return reply.code(409).send({ error: "an organization with this public key already exists" });

      const org = await registerOrganization({ name, type, publicKey, email, password });
      const token = app.jwt.sign({ orgId: org.id });
      return reply.code(201).send({ organization: serializeOrg(org), token });
    }
  );

  app.post<{ Body: { email: string; password: string } }>("/auth/login", async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return reply.code(400).send({ error: "email and password are required" });
    const org = await verifyLogin(email, password);
    if (!org) return reply.code(401).send({ error: "invalid credentials" });
    const token = app.jwt.sign({ orgId: org.id });
    return { organization: serializeOrg(org), token };
  });

  app.get("/orgs", async () => {
    const orgs = await prisma.organization.findMany({ orderBy: { reputation: "desc" } });
    return orgs.map(serializeOrg);
  });

  app.get<{ Params: { id: string } }>("/orgs/:id", async (req, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return reply.code(404).send({ error: "organization not found" });
    return serializeOrg(org);
  });

  app.post(
    "/reports",
    { preHandler: authenticate },
    async (req, reply) => {
      const orgId = currentOrgId(req);
      const reporter = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

      const fields: Record<string, string> = {};
      let evidenceBuffer: Buffer | null = null;
      let digitalSignature = "";

      if (req.isMultipart()) {
        for await (const part of req.parts()) {
          if (part.type === "file") {
            const file = part as MultipartFile;
            evidenceBuffer = await file.toBuffer();
          } else {
            fields[part.fieldname] = String(part.value);
          }
        }
        digitalSignature = fields.digitalSignature ?? "";
      } else {
        const body = req.body as Record<string, string>;
        Object.assign(fields, body);
        digitalSignature = fields.digitalSignature ?? "";
      }

      const { indicator, indicatorType, attackType, mitreTechnique, severity, description, timestamp } = fields;
      if (!indicator || !indicatorType || !attackType || !mitreTechnique || !severity || !description || !timestamp || !digitalSignature) {
        return reply.code(400).send({
          error: "indicator, indicatorType, attackType, mitreTechnique, severity, description, timestamp, digitalSignature are required",
        });
      }

      const evidenceFileHash = evidenceBuffer ? sha256Hex(evidenceBuffer) : null;

      const signableFields: SignableReportFields = {
        reporterOrgId: orgId,
        indicator,
        indicatorType,
        attackType,
        mitreTechnique,
        severity,
        description,
        evidenceFileHash,
        timestamp,
      };

      const signatureValid = verifyReportSignature(signableFields, digitalSignature, reporter.publicKey);
      if (!signatureValid) {
        return reply.code(400).send({ error: "signature verification failed" });
      }

      const payloadHash = sha256Hex(Buffer.from(canonicalReportPayload(signableFields), "utf-8"));

      const ruleBasedResult = classify({ indicator, description, claimedMitreTechnique: mitreTechnique });
      const { aiConfidence } = await enrichClassification(
        { indicator, indicatorType, description, claimedAttackType: attackType, claimedMitreTechnique: mitreTechnique },
        ruleBasedResult
      );

      const report = await prisma.$transaction(async (tx) => {
        const created = await tx.threatReport.create({
          data: {
            reporterOrgId: orgId,
            indicator,
            indicatorType: indicatorType as IndicatorType,
            attackType,
            mitreTechnique,
            severity,
            description,
            evidenceFileHash,
            digitalSignature,
            aiConfidence,
            payloadHash,
          },
        });

        if (evidenceBuffer) {
          await tx.evidenceFile.create({
            data: {
              threatReportId: created.id,
              originalHash: evidenceFileHash!,
              currentBytes: evidenceBuffer,
            },
          });
        }

        await tx.organization.update({
          where: { id: orgId },
          data: { reportsCount: { increment: 1 } },
        });

        return created;
      });

      let ledgerBlock;
      try {
        ledgerBlock = await appendLedgerBlock(payloadHash, report.id);
      } catch (err) {
        req.log.error(err, "ledger anchoring failed, rolling back report");
        await prisma.threatReport.delete({ where: { id: report.id } });
        await prisma.organization.update({ where: { id: orgId }, data: { reportsCount: { decrement: 1 } } });
        return reply.code(502).send({ error: "ledger anchoring failed, report was not created" });
      }

      const updated = await prisma.threatReport.update({
        where: { id: report.id },
        data: { blockchainBlockId: ledgerBlock.idx },
        include: { reporter: true },
      });

      const confidence = await computeAndPersistConfidence(report.id);

      broadcast({ type: "ledger:block_added", payload: { blockIdx: ledgerBlock.idx, hash: ledgerBlock.hash, ref: report.id } });
      broadcast({
        type: "report:new",
        payload: {
          id: updated.id,
          reporterOrgId: updated.reporterOrgId,
          indicator: updated.indicator,
          indicatorType: updated.indicatorType as IndicatorType,
          attackType: updated.attackType,
          mitreTechnique: updated.mitreTechnique,
          severity: updated.severity as any,
          description: updated.description,
          evidenceFileHash: updated.evidenceFileHash,
          digitalSignature: updated.digitalSignature,
          aiConfidence: updated.aiConfidence,
          status: confidence.status,
          blockchainBlockId: updated.blockchainBlockId,
          payloadHash: updated.payloadHash,
          createdAt: updated.createdAt.toISOString(),
          reporter: serializeOrg(updated.reporter),
          confidenceScore: confidence.score,
        },
      });

      return reply.code(201).send({
        ...updated,
        status: confidence.status,
        confidenceScore: confidence.score,
        blockchainVerified: true,
        signatureValid: true,
      });
    }
  );

  app.get("/reports", async () => {
    const reports = await prisma.threatReport.findMany({
      include: { reporter: true, confidenceScore: true },
      orderBy: { createdAt: "desc" },
    });
    return reports.map((r) => ({ ...r, confidenceScore: r.confidenceScore?.score ?? 0 }));
  });

  app.get<{ Params: { id: string } }>("/reports/:id", async (req, reply) => {
    const report = await prisma.threatReport.findUnique({
      where: { id: req.params.id },
      include: { reporter: true, confidenceScore: true, evidence: true, confirmations: true },
    });
    if (!report) return reply.code(404).send({ error: "report not found" });

    let evidenceIntegrity: boolean | null = null;
    if (report.evidence) {
      const liveHash = sha256Hex(Buffer.from(report.evidence.currentBytes));
      evidenceIntegrity = liveHash === report.evidence.originalHash;
    }

    let blockchainVerified = false;
    if (report.blockchainBlockId !== null) {
      const block = await getLedgerBlock(report.blockchainBlockId);
      blockchainVerified = !!block && block.payload_hash === report.payloadHash;
    }

    return { ...report, confidenceScore: report.confidenceScore?.score ?? 0, evidenceIntegrity, blockchainVerified };
  });

  app.post<{ Params: { id: string } }>("/reports/:id/simulate-tampering", { preHandler: authenticate }, async (req, reply) => {
    const report = await prisma.threatReport.findUnique({
      where: { id: req.params.id },
      include: { evidence: true },
    });
    if (!report) return reply.code(404).send({ error: "report not found" });
    if (!report.evidence) return reply.code(400).send({ error: "report has no evidence file to tamper with" });

    const tamperedBytes = Buffer.concat([Buffer.from(report.evidence.currentBytes), Buffer.from("__TAMPERED__")]);
    await prisma.evidenceFile.update({
      where: { threatReportId: report.id },
      data: { currentBytes: tamperedBytes },
    });

    const message = `EVIDENCE TAMPERING DETECTED — stored evidence no longer matches the hash anchored on the ledger at block #${report.blockchainBlockId}`;
    broadcast({ type: "tamper:detected", payload: { reportId: report.id, kind: "evidence", message } });

    return { tampered: true, message };
  });

  app.get("/ledger/verify", async () => verifyLedgerChain());
}
