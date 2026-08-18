import type {
  AccessAttempt,
  AnalyticsSummary,
  AuditLogEntry,
  Campaign,
  CampaignDetail,
  ConfirmationType,
  Organization,
  ReportAttachmentSummary,
  ReportComment,
  SecurityPolicyRules,
  ThreatReport,
} from "@sixsync/shared";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `request to ${path} failed with ${res.status}`);
  }
  return body as T;
}

export interface RegisterInput {
  name: string;
  type: Organization["type"];
  publicKey: string;
  email: string;
  password: string;
}

export function registerOrganization(input: RegisterInput) {
  return request<{ organization: Organization; token: string }>("/orgs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(email: string, password: string) {
  return request<{ organization: Organization; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getOrgs() {
  return request<Organization[]>("/orgs");
}

export function getReports() {
  return request<ThreatReport[]>("/reports");
}

export function getReportDetail(id: string) {
  return request<ThreatReport & { evidenceIntegrity: boolean | null; blockchainVerified: boolean }>(`/reports/${id}`);
}

export function submitReport(formData: FormData, token: string) {
  return request<ThreatReport>("/reports", { method: "POST", body: formData }, token);
}

export function confirmReport(reportId: string, type: ConfirmationType, token: string) {
  return request(`/reports/${reportId}/confirmations`, { method: "POST", body: JSON.stringify({ type }) }, token);
}

export function simulateTampering(reportId: string, token: string) {
  return request<{ tampered: boolean; message: string }>(`/reports/${reportId}/simulate-tampering`, { method: "POST" }, token);
}

export interface ThreatFeedItem {
  id: string;
  indicator: string;
  indicatorType: string;
  attackType: string;
  mitreTechnique: string;
  severity: string;
  status: string;
  confidence: number;
  reporterOrgName: string;
  createdAt: string;
  resolvedIp: string | null;
  geoLat: number | null;
  geoLon: number | null;
  geoCountry: string | null;
  geoCity: string | null;
  abuseScore: number | null;
}

export function getThreatFeed() {
  return request<ThreatFeedItem[]>("/threat-feed");
}

export function getCampaigns() {
  return request<Campaign[]>("/campaigns");
}

export function getCampaignDetail(id: string) {
  return request<CampaignDetail>(`/campaigns/${id}`);
}

export function postAccessAttempt(
  fields: { user: string; ip: string; deviceFingerprint: string; passwordValid: boolean },
  token: string
) {
  return request<AccessAttempt>("/access-attempts", { method: "POST", body: JSON.stringify(fields) }, token);
}

export function getAccessAttempts(token: string) {
  return request<AccessAttempt[]>("/access-attempts", {}, token);
}

export function getPolicies(token: string) {
  return request<SecurityPolicyRules>("/policies", {}, token);
}

export function putPolicies(rules: SecurityPolicyRules, token: string) {
  return request<SecurityPolicyRules>("/policies", { method: "PUT", body: JSON.stringify(rules) }, token);
}

export function getAuditLog(params: { limit?: number; orgId?: string; action?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.orgId) qs.set("orgId", params.orgId);
  if (params.action) qs.set("action", params.action);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<AuditLogEntry[]>(`/audit${suffix}`);
}

export function getAnalyticsSummary() {
  return request<AnalyticsSummary>("/analytics/summary");
}

export function getReportAttachments(reportId: string) {
  return request<ReportAttachmentSummary[]>(`/reports/${reportId}/attachments`);
}

export function uploadAttachment(reportId: string, formData: FormData, token: string) {
  return request<{ attachments: { id: string; filename: string; size: number }[] }>(
    `/reports/${reportId}/attachments`,
    { method: "POST", body: formData },
    token
  );
}

export function attachmentDownloadUrl(attachmentId: string) {
  return `${API_URL}/attachments/${attachmentId}/download`;
}

export function getReportComments(reportId: string) {
  return request<ReportComment[]>(`/reports/${reportId}/comments`);
}

export function postComment(reportId: string, body: string, token: string) {
  return request<ReportComment>(`/reports/${reportId}/comments`, { method: "POST", body: JSON.stringify({ body }) }, token);
}

export function verifyLedger() {
  return request<{ valid: boolean; blockCount: number; brokenAtIndex: number | null; reason: string | null }>(
    "/ledger/verify"
  );
}
