export type OrgType = "BANK" | "HOSPITAL" | "COMPANY" | "GOVERNMENT" | "UNIVERSITY" | "CERT";
export type IndicatorType = "IP" | "DOMAIN" | "HASH" | "URL";
export type ReportStatus = "REPORTED" | "CONFIRMED" | "CRITICAL" | "DISPUTED";
export type ConfirmationType = "CONFIRM" | "DISPUTE";
export type AccessDecision = "ALLOW" | "MFA" | "RESTRICT" | "BLOCK";
export type Severity = "low" | "medium" | "high" | "critical";

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  did: string;
  publicKey: string;
  reputation: number;
  reportsCount: number;
  confirmedCount: number;
  disputedCount: number;
  accuracyPct: number;
  createdAt: string;
}

export interface ScoreBreakdown {
  reporterReputation: number;
  evidenceScore: number;
  aiConfidence: number;
  freshness: number;
  confirmationScore: number;
  disputePenalty: number;
  weights: { reputation: number; evidence: number; aiConfidence: number; confirmation: number; freshness: number };
}

export interface ConfirmationWithOrg {
  id: string;
  type: ConfirmationType;
  evidenceNote: string | null;
  createdAt: string;
  confirmingOrgId: string;
  confirmingOrgName: string;
  confirmingOrgReputation: number;
}

export interface ThreatReport {
  id: string;
  reporterOrgId: string;
  indicator: string;
  indicatorType: IndicatorType;
  attackType: string;
  mitreTechnique: string;
  severity: Severity;
  description: string;
  evidenceFileHash: string | null;
  digitalSignature: string;
  aiConfidence: number;
  status: ReportStatus;
  blockchainBlockId: number | null;
  payloadHash: string;
  createdAt: string;
  reporter?: Organization;
  confidenceScore?: number;
  blockchainVerified?: boolean;
  signatureValid?: boolean;
  evidenceIntegrity?: boolean;
  resolvedIp?: string | null;
  geoLat?: number | null;
  geoLon?: number | null;
  geoCountry?: string | null;
  geoCity?: string | null;
  abuseScore?: number | null;
  scoreBreakdown?: ScoreBreakdown;
  confirmations?: ConfirmationWithOrg[];
}

export interface Confirmation {
  id: string;
  threatReportId: string;
  confirmingOrgId: string;
  type: ConfirmationType;
  evidenceNote: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  commonTechniques: string[];
  confidence: number;
  detectedAt: string;
  updatedAt: string;
  indicatorCount?: number;
  orgCount?: number;
}

export interface CampaignIndicatorSummary {
  id: string;
  indicator: string;
  indicatorType: IndicatorType;
  attackType: string;
  mitreTechnique: string;
  severity: Severity;
  status: ReportStatus;
  confidence: number;
  reporterOrgName: string;
  createdAt: string;
}

export interface CampaignOrgSummary {
  id: string;
  name: string;
  type: OrgType;
  reputation: number;
}

export interface CampaignDetail extends Campaign {
  indicators: CampaignIndicatorSummary[];
  orgs: CampaignOrgSummary[];
}

export interface RiskBreakdown {
  identityRisk: number;
  deviceRisk: number;
  locationRisk: number;
  ipThreatRisk: number;
  behaviorRisk: number;
  totalRiskScore: number;
}

export interface AccessAttempt extends RiskBreakdown {
  id: string;
  user: string;
  organizationId: string;
  ip: string;
  deviceFingerprint: string;
  passwordValid: boolean;
  decision: AccessDecision;
  policyApplied: string | null;
  createdAt: string;
}

export interface SecurityPolicyRules {
  thresholds: { allow: number; mfa: number; restrict: number };
  overrides: Array<{ if: string; then: AccessDecision; reason: string }>;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorOrgId: string | null;
  actorOrgName: string | null;
  targetType: string | null;
  targetId: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReportAttachmentSummary {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedByOrgName: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalReports: number;
  totalOrgs: number;
  totalCampaigns: number;
  statusBreakdown: Array<{ status: ReportStatus; count: number }>;
  attackTypeBreakdown: Array<{ attackType: string; count: number }>;
  mitreBreakdown: Array<{ mitreTechnique: string; count: number }>;
  reportsByDay: Array<{ date: string; count: number }>;
  topOrgs: Array<{ name: string; reportsCount: number; reputation: number }>;
}
