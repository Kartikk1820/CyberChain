-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('BANK', 'HOSPITAL', 'COMPANY', 'GOVERNMENT', 'UNIVERSITY', 'CERT');

-- CreateEnum
CREATE TYPE "IndicatorType" AS ENUM ('IP', 'DOMAIN', 'HASH', 'URL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('REPORTED', 'CONFIRMED', 'CRITICAL', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ConfirmationType" AS ENUM ('CONFIRM', 'DISPUTE');

-- CreateEnum
CREATE TYPE "AccessDecision" AS ENUM ('ALLOW', 'MFA', 'RESTRICT', 'BLOCK');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "did" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedCount" INTEGER NOT NULL DEFAULT 0,
    "disputedCount" INTEGER NOT NULL DEFAULT 0,
    "accuracyPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyPair" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT,
    "generationMode" TEXT NOT NULL DEFAULT 'client',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "threatReportId" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "currentBytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatReport" (
    "id" TEXT NOT NULL,
    "reporterOrgId" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "indicatorType" "IndicatorType" NOT NULL,
    "attackType" TEXT NOT NULL,
    "mitreTechnique" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceFileHash" TEXT,
    "digitalSignature" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'REPORTED',
    "blockchainBlockId" INTEGER,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreatReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "threatReportId" TEXT NOT NULL,
    "confirmingOrgId" TEXT NOT NULL,
    "type" "ConfirmationType" NOT NULL,
    "evidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatConfidenceScore" (
    "threatReportId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "lastComputedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatConfidenceScore_pkey" PRIMARY KEY ("threatReportId")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commonTechniques" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignIndicator" (
    "campaignId" TEXT NOT NULL,
    "threatReportId" TEXT NOT NULL,

    CONSTRAINT "CampaignIndicator_pkey" PRIMARY KEY ("campaignId","threatReportId")
);

-- CreateTable
CREATE TABLE "CampaignOrg" (
    "campaignId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CampaignOrg_pkey" PRIMARY KEY ("campaignId","organizationId")
);

-- CreateTable
CREATE TABLE "AccessAttempt" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "passwordValid" BOOLEAN NOT NULL,
    "identityRisk" DOUBLE PRECISION NOT NULL,
    "deviceRisk" DOUBLE PRECISION NOT NULL,
    "locationRisk" DOUBLE PRECISION NOT NULL,
    "ipThreatRisk" DOUBLE PRECISION NOT NULL,
    "behaviorRisk" DOUBLE PRECISION NOT NULL,
    "totalRiskScore" DOUBLE PRECISION NOT NULL,
    "decision" "AccessDecision" NOT NULL,
    "policyApplied" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPolicy" (
    "organizationId" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_did_key" ON "Organization"("did");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_publicKey_key" ON "Organization"("publicKey");

-- CreateIndex
CREATE INDEX "Organization_reputation_idx" ON "Organization"("reputation");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_key" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KeyPair_organizationId_key" ON "KeyPair"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceFile_threatReportId_key" ON "EvidenceFile"("threatReportId");

-- CreateIndex
CREATE INDEX "ThreatReport_indicator_idx" ON "ThreatReport"("indicator");

-- CreateIndex
CREATE INDEX "ThreatReport_mitreTechnique_idx" ON "ThreatReport"("mitreTechnique");

-- CreateIndex
CREATE INDEX "ThreatReport_status_idx" ON "ThreatReport"("status");

-- CreateIndex
CREATE INDEX "ThreatReport_createdAt_idx" ON "ThreatReport"("createdAt");

-- CreateIndex
CREATE INDEX "Confirmation_threatReportId_idx" ON "Confirmation"("threatReportId");

-- CreateIndex
CREATE UNIQUE INDEX "Confirmation_threatReportId_confirmingOrgId_key" ON "Confirmation"("threatReportId", "confirmingOrgId");

-- CreateIndex
CREATE INDEX "AccessAttempt_organizationId_createdAt_idx" ON "AccessAttempt"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyPair" ADD CONSTRAINT "KeyPair_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_threatReportId_fkey" FOREIGN KEY ("threatReportId") REFERENCES "ThreatReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatReport" ADD CONSTRAINT "ThreatReport_reporterOrgId_fkey" FOREIGN KEY ("reporterOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_threatReportId_fkey" FOREIGN KEY ("threatReportId") REFERENCES "ThreatReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_confirmingOrgId_fkey" FOREIGN KEY ("confirmingOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatConfidenceScore" ADD CONSTRAINT "ThreatConfidenceScore_threatReportId_fkey" FOREIGN KEY ("threatReportId") REFERENCES "ThreatReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIndicator" ADD CONSTRAINT "CampaignIndicator_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIndicator" ADD CONSTRAINT "CampaignIndicator_threatReportId_fkey" FOREIGN KEY ("threatReportId") REFERENCES "ThreatReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignOrg" ADD CONSTRAINT "CampaignOrg_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignOrg" ADD CONSTRAINT "CampaignOrg_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessAttempt" ADD CONSTRAINT "AccessAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityPolicy" ADD CONSTRAINT "SecurityPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
