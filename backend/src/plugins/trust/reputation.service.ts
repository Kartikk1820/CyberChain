import { prisma } from "../../db/prisma";
import { computeReputationUpdate } from "./reputationFormula";

export interface ReputationUpdateResult {
  orgId: string;
  oldValue: number;
  newValue: number;
  delta: number;
}

/**
 * Recomputes the reporter's reputation delta attributable to a single report,
 * capped at [-20, +10] total regardless of how many confirmations/disputes it accrues,
 * then applies only the marginal (not-yet-applied) portion of that cap.
 */
export async function applyReputationUpdate(threatReportId: string): Promise<ReputationUpdateResult> {
  const report = await prisma.threatReport.findUniqueOrThrow({
    where: { id: threatReportId },
    include: {
      reporter: true,
      confirmations: { include: { confirmingOrg: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const computation = computeReputationUpdate({
    reporterCurrentReputation: report.reporter.reputation,
    orderedConfirmations: report.confirmations.map((c) => ({
      type: c.type,
      confirmingOrgReputation: c.confirmingOrg.reputation,
    })),
  });

  await prisma.organization.update({
    where: { id: report.reporterOrgId },
    data: { reputation: computation.newValue },
  });

  return { orgId: report.reporterOrgId, ...computation };
}

export async function recomputeAccuracy(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  const denominator = org.confirmedCount + org.disputedCount;
  const accuracyPct = denominator > 0 ? (100 * org.confirmedCount) / denominator : 0;
  await prisma.organization.update({ where: { id: orgId }, data: { accuracyPct } });
  return accuracyPct;
}
