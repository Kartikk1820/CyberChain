import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { recordAudit, AUDIT_ACTIONS } from "../audit/audit.service";

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface AlertEmailInput {
  to: string[];
  subject: string;
  html: string;
}

export interface AlertEmailResult {
  sent: boolean;
  simulated: boolean;
  recipientCount: number;
}

/**
 * Gated on ENABLE_EMAIL_ALERTS + SMTP_HOST, same graceful-degrade pattern as llmEnrichment/abuseIpdbClient:
 * if unconfigured or the send fails, log and return a "simulated" result instead of throwing —
 * alerting must never block the caller's request.
 */
export async function sendAlertEmail(input: AlertEmailInput): Promise<AlertEmailResult> {
  if (input.to.length === 0) return { sent: false, simulated: false, recipientCount: 0 };

  if (!env.ENABLE_EMAIL_ALERTS || !env.SMTP_HOST) {
    console.log(`[email-alert] simulated (SMTP not configured) — to=${input.to.join(",")} subject="${input.subject}"`);
    return { sent: false, simulated: true, recipientCount: input.to.length };
  }

  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: input.to.join(","),
      subject: input.subject,
      html: input.html,
    });
    return { sent: true, simulated: false, recipientCount: input.to.length };
  } catch (err) {
    console.error("[email-alert] send failed, continuing without blocking caller", err);
    return { sent: false, simulated: true, recipientCount: input.to.length };
  }
}

/**
 * ALERT_EMAIL_OVERRIDE lets a demo route every alert to one real inbox regardless of which
 * (often fake .demo) org email would otherwise be used — avoids bounce noise during a live demo.
 */
export async function resolveAlertRecipients(orgIds: string[]): Promise<string[]> {
  if (env.ALERT_EMAIL_OVERRIDE) return [env.ALERT_EMAIL_OVERRIDE];
  if (orgIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { organizationId: { in: orgIds } },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

interface CriticalReportInfo {
  id: string;
  indicator: string;
  indicatorType: string;
  attackType: string;
  mitreTechnique: string;
}

/** Never throws — wraps the whole alert+audit flow so a status transition can fire-and-forget this. */
export async function sendCriticalReportAlert(report: CriticalReportInfo): Promise<void> {
  try {
    const allOrgs = await prisma.organization.findMany({ select: { id: true } });
    const recipients = await resolveAlertRecipients(allOrgs.map((o) => o.id));
    const result = await sendAlertEmail({
      to: recipients,
      subject: `[CyberChain] CRITICAL threat: ${report.indicator}`,
      html: `<p><strong>${report.indicator}</strong> (${report.indicatorType}) has reached <strong>CRITICAL</strong> status.</p>
        <p>Attack type: ${report.attackType}<br/>MITRE technique: ${report.mitreTechnique}</p>
        <p>Review it in CyberChain.</p>`,
    });
    await recordAudit({
      action: AUDIT_ACTIONS.ALERT_EMAIL_SENT,
      targetType: "ThreatReport",
      targetId: report.id,
      message: `CRITICAL alert for ${report.indicator} ${result.simulated ? "(simulated — SMTP not configured)" : "sent"} to ${result.recipientCount} recipient(s)`,
      metadata: { recipientCount: result.recipientCount, simulated: result.simulated },
    });
  } catch (err) {
    console.error("[email-alert] critical report alert failed, continuing", err);
  }
}

interface CampaignAlertInfo {
  id: string;
  name: string;
  commonTechniques: string[];
  confidence: number;
}

/** Never throws — same fire-and-forget contract as sendCriticalReportAlert. */
export async function sendCampaignAlert(campaign: CampaignAlertInfo, orgIds: string[]): Promise<void> {
  try {
    const recipients = await resolveAlertRecipients(orgIds);
    const result = await sendAlertEmail({
      to: recipients,
      subject: `[CyberChain] Coordinated campaign detected: ${campaign.name}`,
      html: `<p><strong>${campaign.name}</strong> detected — confidence ${campaign.confidence.toFixed(0)}%.</p>
        <p>Techniques: ${campaign.commonTechniques.join(", ")}</p>
        <p>Review it in CyberChain.</p>`,
    });
    await recordAudit({
      action: AUDIT_ACTIONS.ALERT_EMAIL_SENT,
      targetType: "Campaign",
      targetId: campaign.id,
      message: `Campaign alert for "${campaign.name}" ${result.simulated ? "(simulated — SMTP not configured)" : "sent"} to ${result.recipientCount} recipient(s)`,
      metadata: { recipientCount: result.recipientCount, simulated: result.simulated },
    });
  } catch (err) {
    console.error("[email-alert] campaign alert failed, continuing", err);
  }
}
