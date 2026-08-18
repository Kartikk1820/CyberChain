import { prisma } from "../../db/prisma";

export const AUDIT_ACTIONS = {
  ORG_REGISTERED: "ORG_REGISTERED",
  ORG_LOGIN: "ORG_LOGIN",
  REPORT_SUBMITTED: "REPORT_SUBMITTED",
  REPORT_CONFIRMED: "REPORT_CONFIRMED",
  REPORT_DISPUTED: "REPORT_DISPUTED",
  TAMPER_SIMULATED: "TAMPER_SIMULATED",
  CAMPAIGN_DETECTED: "CAMPAIGN_DETECTED",
  ATTACHMENT_UPLOADED: "ATTACHMENT_UPLOADED",
  ALERT_EMAIL_SENT: "ALERT_EMAIL_SENT",
  COMMENT_POSTED: "COMMENT_POSTED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface RecordAuditInput {
  action: AuditAction;
  actorOrgId?: string | null;
  targetType?: string;
  targetId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit write. Never throws — a failed audit write must not break the
 * action it's logging, matching the graceful-degrade convention used elsewhere in this codebase.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorOrgId: input.actorOrgId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        message: input.message,
        metadata: input.metadata as any,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record entry, continuing", err);
  }
}
