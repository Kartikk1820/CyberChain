import nacl from "tweetnacl";
import { PrismaClient } from "@prisma/client";
import { canonicalReportPayload, type IndicatorType, type OrgType, type SignableReportFields } from "@sixsync/shared";
import { registerOrganization } from "../src/plugins/trust/identity.service";
import { sha256Hex } from "../src/plugins/trust/evidence.service";
import { appendLedgerBlock } from "../src/plugins/trust/ledgerClient";
import { classify } from "../src/plugins/intel/classifier";
import { computeAndPersistConfidence } from "../src/plugins/intel/confidence.service";
import { applyReputationUpdate } from "../src/plugins/trust/reputation.service";
import { runCampaignCorrelation } from "../src/plugins/intel/campaign.service";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "sixsync-demo-2026";

function b64(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64");
}

interface SeedActor {
  orgId: string;
  publicKey: string;
  secretKey: Uint8Array;
}

async function createOrg(name: string, type: OrgType, email: string): Promise<SeedActor> {
  const kp = nacl.sign.keyPair();
  const publicKey = b64(kp.publicKey);
  const org = await registerOrganization({ name, type, publicKey, email, password: DEMO_PASSWORD });
  return { orgId: org.id, publicKey, secretKey: kp.secretKey };
}

interface DemoGeo {
  resolvedIp: string;
  geoLat: number;
  geoLon: number;
  geoCountry: string;
  geoCity: string;
  abuseScore: number;
}

interface ReportInput {
  actor: SeedActor;
  indicator: string;
  indicatorType: IndicatorType;
  mitreTechnique: string;
  severity: string;
  description: string;
  evidenceBytes?: Buffer;
  ageHoursAgo?: number;
  geo?: DemoGeo;
}

async function createSignedReport(input: ReportInput): Promise<string> {
  const { actor, indicator, indicatorType, mitreTechnique, severity, description, evidenceBytes, geo } = input;
  const evidenceFileHash = evidenceBytes ? sha256Hex(evidenceBytes) : null;
  const timestamp = new Date().toISOString();

  const classification = classify({ indicator, description, claimedMitreTechnique: mitreTechnique });

  const signable: SignableReportFields = {
    reporterOrgId: actor.orgId,
    indicator,
    indicatorType,
    attackType: classification.suggestedTechnique.defaultAttackType,
    mitreTechnique,
    severity,
    description,
    evidenceFileHash,
    timestamp,
  };
  const message = Buffer.from(canonicalReportPayload(signable), "utf-8");
  const digitalSignature = b64(nacl.sign.detached(message, actor.secretKey));
  const payloadHash = sha256Hex(Buffer.from(canonicalReportPayload(signable), "utf-8"));

  const report = await prisma.threatReport.create({
    data: {
      reporterOrgId: actor.orgId,
      indicator,
      indicatorType,
      attackType: signable.attackType,
      mitreTechnique,
      severity,
      description,
      evidenceFileHash,
      digitalSignature,
      aiConfidence: classification.aiConfidence,
      payloadHash,
      resolvedIp: geo?.resolvedIp,
      geoLat: geo?.geoLat,
      geoLon: geo?.geoLon,
      geoCountry: geo?.geoCountry,
      geoCity: geo?.geoCity,
      abuseScore: geo?.abuseScore,
    },
  });

  if (evidenceBytes) {
    await prisma.evidenceFile.create({
      data: { threatReportId: report.id, originalHash: evidenceFileHash!, currentBytes: evidenceBytes },
    });
  }

  await prisma.organization.update({ where: { id: actor.orgId }, data: { reportsCount: { increment: 1 } } });

  const block = await appendLedgerBlock(payloadHash, report.id);
  await prisma.threatReport.update({ where: { id: report.id }, data: { blockchainBlockId: block.idx } });

  if (input.ageHoursAgo) {
    const createdAt = new Date(Date.now() - input.ageHoursAgo * 60 * 60 * 1000);
    await prisma.threatReport.update({ where: { id: report.id }, data: { createdAt } });
  }

  await computeAndPersistConfidence(report.id);
  return report.id;
}

async function confirm(actor: SeedActor, reportId: string, type: "CONFIRM" | "DISPUTE", note?: string) {
  await prisma.confirmation.create({
    data: { threatReportId: reportId, confirmingOrgId: actor.orgId, type, evidenceNote: note },
  });
  await applyReputationUpdate(reportId);
  await computeAndPersistConfidence(reportId);
}

async function main() {
  const existing = await prisma.organization.count();
  if (existing > 0) {
    console.log(`seed: ${existing} organizations already present, skipping`);
    return;
  }

  console.log("seed: creating demo organizations…");
  const bankA = await createOrg("Bank A", "BANK", "security@bank-a.demo");
  const hospitalB = await createOrg("Hospital B", "HOSPITAL", "soc@hospital-b.demo");
  const certC = await createOrg("CERT C", "CERT", "watch@cert-c.demo");
  const universityD = await createOrg("University D", "UNIVERSITY", "infosec@university-d.demo");
  const companyE = await createOrg("Company E", "COMPANY", "security@company-e.demo");

  console.log("seed: Bank A reports a phishing IP, confirmed by Hospital B and CERT C…");
  const phishingIp = await createSignedReport({
    actor: bankA,
    indicator: "198.51.100.42",
    indicatorType: "IP",
    mitreTechnique: "T1566",
    severity: "high",
    description:
      "Phishing infrastructure observed serving credential-harvesting pages impersonating our online banking login. Multiple customer reports of suspicious emails linking to this IP.",
    ageHoursAgo: 20,
    geo: {
      resolvedIp: "198.51.100.42",
      geoLat: 55.7558,
      geoLon: 37.6173,
      geoCountry: "RU",
      geoCity: "Moscow",
      abuseScore: 92,
    },
  });
  await confirm(hospitalB, phishingIp, "CONFIRM", "Same infrastructure seen targeting our patient portal logins.");
  await confirm(certC, phishingIp, "CONFIRM", "Corroborated via passive DNS and threat intel partners.");

  console.log("seed: Hospital B reports a related phishing domain, confirmed by CERT C…");
  const phishingDomain = await createSignedReport({
    actor: hospitalB,
    indicator: "secure-login-verify.example",
    indicatorType: "DOMAIN",
    mitreTechnique: "T1566",
    severity: "high",
    description:
      "Domain hosting a near-identical clone of our patient portal login page, registered days ago, resolving to infrastructure shared with other reported phishing indicators.",
    ageHoursAgo: 14,
    geo: {
      resolvedIp: "198.51.100.50",
      geoLat: 55.7558,
      geoLon: 37.6173,
      geoCountry: "RU",
      geoCity: "Moscow",
      abuseScore: 88,
    },
  });
  await confirm(certC, phishingDomain, "CONFIRM", "Registrar and hosting overlap with the Bank A IP report.");
  await confirm(bankA, phishingDomain, "CONFIRM", "Matches phishing kit fingerprint seen in our own incident.");

  console.log("seed: CERT C reports a third related phishing IP (completes the campaign cluster)…");
  const thirdIndicatorEvidence = Buffer.from(
    "Packet capture excerpt: TLS handshake to 203.0.113.77 serving cloned login form assets identical to prior campaign infrastructure.",
    "utf-8"
  );
  const thirdPhishingIp = await createSignedReport({
    actor: certC,
    indicator: "203.0.113.77",
    indicatorType: "IP",
    mitreTechnique: "T1566",
    severity: "critical",
    description:
      "Third piece of infrastructure in the same coordinated phishing campaign, sharing TLS certificate fingerprints with previously reported indicators. High confidence this is part of an organized operation.",
    evidenceBytes: thirdIndicatorEvidence,
    ageHoursAgo: 6,
    geo: {
      resolvedIp: "203.0.113.77",
      geoLat: 39.9042,
      geoLon: 116.4074,
      geoCountry: "CN",
      geoCity: "Beijing",
      abuseScore: 96,
    },
  });
  await confirm(bankA, thirdPhishingIp, "CONFIRM", "Certificate fingerprint match confirmed against our own telemetry.");
  await confirm(hospitalB, thirdPhishingIp, "CONFIRM", "Consistent with the campaign pattern.");
  await confirm(universityD, thirdPhishingIp, "CONFIRM", "Also observed reconnaissance traffic from this host.");

  console.log("seed: University D reports a brute-force indicator (unconfirmed, stays at REPORTED)…");
  await createSignedReport({
    actor: universityD,
    indicator: "192.0.2.150",
    indicatorType: "IP",
    mitreTechnique: "T1110",
    severity: "medium",
    description: "Repeated failed SSH login attempts against research lab servers, consistent with automated credential stuffing.",
    ageHoursAgo: 2,
    geo: {
      resolvedIp: "192.0.2.150",
      geoLat: -23.5505,
      geoLon: -46.6333,
      geoCountry: "BR",
      geoCity: "Sao Paulo",
      abuseScore: 65,
    },
  });

  console.log("seed: Company E reports a disputed indicator…");
  const disputed = await createSignedReport({
    actor: companyE,
    indicator: "198.51.100.9",
    indicatorType: "IP",
    mitreTechnique: "T1595",
    severity: "low",
    description: "IP observed port-scanning our perimeter, possible reconnaissance activity ahead of a targeted attack.",
    ageHoursAgo: 1,
    geo: {
      resolvedIp: "198.51.100.9",
      geoLat: 52.3676,
      geoLon: 4.9041,
      geoCountry: "NL",
      geoCity: "Amsterdam",
      abuseScore: 20,
    },
  });
  await confirm(certC, disputed, "DISPUTE", "This is a known internet-wide research scanner, not targeted recon.");

  console.log("seed: running campaign correlation sweep…");
  await runCampaignCorrelation();

  console.log("seed: applying demo-realistic reputation variance…");
  await prisma.organization.update({ where: { id: universityD.orgId }, data: { reputation: 68 } });
  await prisma.organization.update({ where: { id: companyE.orgId }, data: { reputation: 45 } });

  console.log("seed: complete.");
  console.log(`  demo login password for every seeded org: "${DEMO_PASSWORD}"`);
  console.log("  emails: security@bank-a.demo, soc@hospital-b.demo, watch@cert-c.demo, infosec@university-d.demo, security@company-e.demo");
  console.log("");
  console.log("  To confirm/dispute/report live as a seeded org during a demo, sign in with its email/password above");
  console.log("  and load this keyfile on the sign-in screen (or register a brand-new org from the UI instead):");
  console.log(
    JSON.stringify({ orgId: bankA.orgId, publicKey: bankA.publicKey, privateKey: b64(bankA.secretKey) }, null, 2)
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
