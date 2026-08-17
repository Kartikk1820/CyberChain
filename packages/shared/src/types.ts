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
