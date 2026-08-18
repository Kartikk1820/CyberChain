import { prisma } from "../../db/prisma";
import { recomputeAccuracy } from "../trust/reputation.service";
import { computeConfidence, evidenceQuality, INDICATOR_FORMAT, type ConfidenceComputation } from "./confidenceFormula";

export type { ConfidenceComputation } from "./confidenceFormula";

async function gatherConfidenceInputs(threatReportId: string) {
  const report = await prisma.threatReport.findUniqueOrThrow({
    where: { id: threatReportId },
    include: {
      reporter: true,
      evidence: true,
      confirmations: { include: { confirmingOrg: true } },
    },
  });

  const formatRegex = INDICATOR_FORMAT[report.indicatorType];
  const indicatorFormatValid = formatRegex ? formatRegex.test(report.indicator) : false;
  const evidenceScore = evidenceQuality(!!report.evidence, indicatorFormatValid, report.description.trim().length);
  const ageHours = (Date.now() - report.createdAt.getTime()) / (1000 * 60 * 60);

  return {
    report,
    inputs: {
      reporterReputation: report.reporter.reputation,
      evidenceScore,
      aiConfidence: report.aiConfidence,
      ageHours,
      currentStatus: report.status,
      confirmations: report.confirmations.map((c) => ({
        type: c.type,
        confirmingOrgId: c.confirmingOrgId,
        confirmingOrgReputation: c.confirmingOrg.reputation,
      })),
    },
  };
}

/** Recomputes the confidence score/breakdown without writing anything — used to show a live "how was this calculated" view. */
export async function previewConfidence(threatReportId: string): Promise<ConfidenceComputation> {
  const { inputs } = await gatherConfidenceInputs(threatReportId);
  return computeConfidence(inputs);
}

export async function computeAndPersistConfidence(threatReportId: string): Promise<ConfidenceComputation> {
  const { report, inputs } = await gatherConfidenceInputs(threatReportId);
  const computation = computeConfidence(inputs);

  const { score, status } = computation;
  const previousStatus = report.status;

  await prisma.$transaction(async (tx) => {
    await tx.threatConfidenceScore.upsert({
      where: { threatReportId },
      create: { threatReportId, score },
      update: { score },
    });
    await tx.threatReport.update({ where: { id: threatReportId }, data: { status } });

    if (status === "CONFIRMED" && previousStatus !== "CONFIRMED" && previousStatus !== "CRITICAL") {
      await tx.organization.update({
        where: { id: report.reporterOrgId },
        data: { confirmedCount: { increment: 1 } },
      });
    }
    if (status === "DISPUTED" && previousStatus !== "DISPUTED") {
      await tx.organization.update({
        where: { id: report.reporterOrgId },
        data: { disputedCount: { increment: 1 } },
      });
    }
  });

  if (status !== previousStatus) {
    await recomputeAccuracy(report.reporterOrgId);
  }

  return computation;
}
