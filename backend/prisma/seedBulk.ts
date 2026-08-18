import nacl from "tweetnacl";
import { PrismaClient } from "@prisma/client";
import { canonicalReportPayload, type IndicatorType, type OrgType, type SignableReportFields } from "@sixsync/shared";
import { registerOrganization } from "../src/plugins/trust/identity.service";
import { sha256Hex } from "../src/plugins/trust/evidence.service";
import { appendLedgerBlock } from "../src/plugins/trust/ledgerClient";
import { computeAndPersistConfidence } from "../src/plugins/intel/confidence.service";
import { applyReputationUpdate, recomputeAccuracy } from "../src/plugins/trust/reputation.service";
import { runCampaignCorrelation } from "../src/plugins/intel/campaign.service";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "sixsync-demo-2026";
const REPORT_COUNT = 1000;
const MARKER_ORG_NAME = "ICICI Bank";

function b64(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(items: Array<[T, number]>): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [item, w] of items) {
    if (roll < w) return item;
    roll -= w;
  }
  return items[items.length - 1][0];
}

function randomOctet(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomPublicIp(): string {
  let a: number;
  do {
    a = randomOctet(1, 223);
  } while ([10, 127, 169, 192].includes(a));
  let b = randomOctet(0, 255);
  if (a === 172 && b >= 16 && b <= 31) b = 15;
  const c = randomOctet(0, 255);
  const d = randomOctet(1, 254);
  return `${a}.${b}.${c}.${d}`;
}

const ORGS: Array<{ name: string; type: OrgType; email: string }> = [
  { name: "ICICI Bank", type: "BANK", email: "soc@icicibank.demo" },
  { name: "State Bank of India", type: "BANK", email: "cybercell@sbi.demo" },
  { name: "HDFC Bank", type: "BANK", email: "infosec@hdfcbank.demo" },
  { name: "Axis Bank", type: "BANK", email: "soc@axisbank.demo" },
  { name: "Punjab National Bank", type: "BANK", email: "security@pnbindia.demo" },
  { name: "Bank of Baroda", type: "BANK", email: "soc@bankofbaroda.demo" },
  { name: "Kotak Mahindra Bank", type: "BANK", email: "infosec@kotak.demo" },
  { name: "AIIMS Delhi", type: "HOSPITAL", email: "it-security@aiims.demo" },
  { name: "Apollo Hospitals", type: "HOSPITAL", email: "soc@apollohospitals.demo" },
  { name: "Fortis Healthcare", type: "HOSPITAL", email: "cybersec@fortishealthcare.demo" },
  { name: "Max Healthcare", type: "HOSPITAL", email: "security@maxhealthcare.demo" },
  { name: "NPCI", type: "GOVERNMENT", email: "soc@npci.demo" },
  { name: "UIDAI", type: "GOVERNMENT", email: "security@uidai.demo" },
  { name: "Ministry of Electronics and IT", type: "GOVERNMENT", email: "cybercell@meity.demo" },
  { name: "Income Tax Department", type: "GOVERNMENT", email: "infosec@incometax.demo" },
  { name: "IIT Delhi", type: "UNIVERSITY", email: "security@iitdelhi.demo" },
  { name: "IIT Bombay", type: "UNIVERSITY", email: "infosec@iitbombay.demo" },
  { name: "IIT Madras", type: "UNIVERSITY", email: "soc@iitmadras.demo" },
  { name: "IISc Bangalore", type: "UNIVERSITY", email: "security@iisc.demo" },
  { name: "Infosys", type: "COMPANY", email: "soc@infosys.demo" },
  { name: "Tata Consultancy Services", type: "COMPANY", email: "cybersec@tcs.demo" },
  { name: "Wipro", type: "COMPANY", email: "infosec@wipro.demo" },
  { name: "HCL Technologies", type: "COMPANY", email: "soc@hcltech.demo" },
  { name: "Reliance Jio", type: "COMPANY", email: "security@jio.demo" },
  { name: "CERT-In", type: "CERT", email: "incident@cert-in.demo" },
  { name: "NCIIPC", type: "CERT", email: "soc@nciipc.demo" },
];

interface Technique {
  id: string;
  attackType: string;
  descriptions: string[];
}

const TECHNIQUES: Technique[] = [
  {
    id: "T1566",
    attackType: "Phishing",
    descriptions: [
      "Phishing campaign detected serving credential-harvesting pages via spearphishing email lures targeting employee accounts.",
      "Suspicious email lure observed directing users to a cloned login portal, consistent with phishing infrastructure.",
    ],
  },
  {
    id: "T1071",
    attackType: "Command & Control",
    descriptions: [
      "Periodic beacon traffic observed consistent with command and control callback to external infrastructure.",
      "Endpoint exhibiting C2 callback pattern with encoded beacon requests at regular intervals.",
    ],
  },
  {
    id: "T1110",
    attackType: "Brute Force",
    descriptions: [
      "Repeated failed login attempts consistent with automated brute force credential stuffing against exposed services.",
      "Password spray activity detected across multiple accounts, indicative of brute force reconnaissance.",
    ],
  },
  {
    id: "T1486",
    attackType: "Ransomware",
    descriptions: [
      "Ransomware payload observed attempting to encrypt file shares, accompanied by an extortion note.",
      "Endpoint isolated after files began to encrypt rapidly, consistent with ransomware detonation.",
    ],
  },
  {
    id: "T1190",
    attackType: "Exploitation",
    descriptions: [
      "Exploit attempt targeting a known CVE vulnerability in a public-facing application, consistent with RCE attempts.",
      "Automated scanner attempting to exploit an unpatched vulnerability for remote code execution.",
    ],
  },
  {
    id: "T1059",
    attackType: "Malware",
    descriptions: [
      "Malicious script payload delivered via drive-by download, identified as a trojan downloader.",
      "Malware sample observed executing an obfuscated script payload on infected endpoints.",
    ],
  },
  {
    id: "T1498",
    attackType: "DDoS",
    descriptions: [
      "Volumetric DDoS flood observed against public-facing infrastructure, consistent with a coordinated denial of service campaign.",
      "Traffic spike consistent with a SYN flood DoS attack overwhelming edge network capacity.",
    ],
  },
  {
    id: "T1595",
    attackType: "Reconnaissance",
    descriptions: [
      "Port scanning and reconnaissance probing observed against perimeter infrastructure ahead of a targeted attack.",
      "Automated recon scan detected enumerating open services across our external IP range.",
    ],
  },
];

interface GeoPoint {
  country: string;
  city: string;
  lat: number;
  lon: number;
}

const GEO_POOL: GeoPoint[] = [
  { country: "Russia", city: "Moscow", lat: 55.7558, lon: 37.6173 },
  { country: "China", city: "Beijing", lat: 39.9042, lon: 116.4074 },
  { country: "China", city: "Shenyang", lat: 41.8057, lon: 123.4315 },
  { country: "Iran", city: "Tehran", lat: 35.6892, lon: 51.389 },
  { country: "Nigeria", city: "Lagos", lat: 6.5244, lon: 3.3792 },
  { country: "Vietnam", city: "Hanoi", lat: 21.0278, lon: 105.8342 },
  { country: "Brazil", city: "Sao Paulo", lat: -23.5505, lon: -46.6333 },
  { country: "Netherlands", city: "Amsterdam", lat: 52.3676, lon: 4.9041 },
  { country: "Ukraine", city: "Kyiv", lat: 50.4501, lon: 30.5234 },
  { country: "Romania", city: "Bucharest", lat: 44.4268, lon: 26.1025 },
  { country: "Indonesia", city: "Jakarta", lat: -6.2088, lon: 106.8456 },
  { country: "United States", city: "Ashburn", lat: 39.0438, lon: -77.4874 },
  { country: "Germany", city: "Frankfurt", lat: 50.1109, lon: 8.6821 },
  { country: "Singapore", city: "Singapore", lat: 1.3521, lon: 103.8198 },
  { country: "Pakistan", city: "Karachi", lat: 24.8607, lon: 67.0011 },
];

function jitteredGeo(point: GeoPoint): GeoPoint {
  return {
    ...point,
    lat: point.lat + (Math.random() - 0.5) * 3,
    lon: point.lon + (Math.random() - 0.5) * 3,
  };
}

const SEVERITIES: Array<["low" | "medium" | "high" | "critical", number]> = [
  ["low", 20],
  ["medium", 35],
  ["high", 30],
  ["critical", 15],
];

function abuseScoreForSeverity(severity: string): number {
  const ranges: Record<string, [number, number]> = {
    low: [5, 25],
    medium: [20, 55],
    high: [45, 80],
    critical: [70, 99],
  };
  const [min, max] = ranges[severity];
  return randomOctet(min, max);
}

const CONFIRM_COUNT_WEIGHTS: Array<[number, number]> = [
  [0, 35],
  [1, 30],
  [2, 20],
  [3, 10],
  [4, 5],
];

interface Actor {
  orgId: string;
  publicKey: string;
  secretKey: Uint8Array;
}

async function createActor(name: string, type: OrgType, email: string): Promise<Actor> {
  const kp = nacl.sign.keyPair();
  const publicKey = b64(kp.publicKey);
  const org = await registerOrganization({ name, type, publicKey, email, password: DEMO_PASSWORD });
  return { orgId: org.id, publicKey, secretKey: kp.secretKey };
}

interface BulkReportInput {
  actor: Actor;
  indicator: string;
  mitreTechnique: string;
  attackType: string;
  severity: string;
  description: string;
  geo: GeoPoint;
  abuseScore: number;
  ageHoursAgo: number;
}

async function createBulkReport(input: BulkReportInput): Promise<string> {
  const { actor, indicator, mitreTechnique, attackType, severity, description, geo, abuseScore } = input;
  const indicatorType: IndicatorType = "IP";
  const timestamp = new Date().toISOString();

  const signable: SignableReportFields = {
    reporterOrgId: actor.orgId,
    indicator,
    indicatorType,
    attackType,
    mitreTechnique,
    severity,
    description,
    evidenceFileHash: null,
    timestamp,
  };
  const message = Buffer.from(canonicalReportPayload(signable), "utf-8");
  const digitalSignature = b64(nacl.sign.detached(message, actor.secretKey));
  const payloadHash = sha256Hex(Buffer.from(canonicalReportPayload(signable), "utf-8"));

  // aiConfidence mirrors classify()'s "claim agrees with description keywords" baseline (85) with
  // a small amount of jitter, avoiding a live classify() call per report for bulk-generation speed.
  const aiConfidence = randomOctet(75, 92);

  const report = await prisma.threatReport.create({
    data: {
      reporterOrgId: actor.orgId,
      indicator,
      indicatorType,
      attackType,
      mitreTechnique,
      severity,
      description,
      evidenceFileHash: null,
      digitalSignature,
      aiConfidence,
      payloadHash,
      resolvedIp: indicator,
      geoLat: geo.lat,
      geoLon: geo.lon,
      geoCountry: geo.country,
      geoCity: geo.city,
      abuseScore,
    },
  });

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

async function confirm(actor: Actor, reportId: string, type: "CONFIRM" | "DISPUTE") {
  await prisma.confirmation.create({
    data: { threatReportId: reportId, confirmingOrgId: actor.orgId, type },
  });
  await applyReputationUpdate(reportId);
  const confidence = await computeAndPersistConfidence(reportId);
  return confidence;
}

async function main() {
  const marker = await prisma.organization.findFirst({ where: { name: MARKER_ORG_NAME } });
  if (marker) {
    console.log(`seedBulk: "${MARKER_ORG_NAME}" already exists — bulk seed has already run, skipping.`);
    return;
  }

  console.log(`seedBulk: creating ${ORGS.length} Indian organizations…`);
  const actors: Actor[] = [];
  for (const o of ORGS) {
    actors.push(await createActor(o.name, o.type, o.email));
  }

  console.log(`seedBulk: generating ${REPORT_COUNT} IP threat reports…`);
  const reportIds: string[] = [];
  for (let i = 0; i < REPORT_COUNT; i++) {
    const reporter = pick(actors);
    const technique = pick(TECHNIQUES);
    const severity = weightedPick(SEVERITIES);
    const geo = jitteredGeo(pick(GEO_POOL));
    const indicator = randomPublicIp();
    const ageHoursAgo = Math.random() * 720; // spread across the last 30 days

    const reportId = await createBulkReport({
      actor: reporter,
      indicator,
      mitreTechnique: technique.id,
      attackType: technique.attackType,
      severity,
      description: pick(technique.descriptions),
      geo,
      abuseScore: abuseScoreForSeverity(severity),
      ageHoursAgo,
    });
    reportIds.push(reportId);

    const confirmCount = weightedPick(CONFIRM_COUNT_WEIGHTS);
    if (confirmCount > 0) {
      const otherActors = actors.filter((a) => a.orgId !== reporter.orgId);
      const shuffled = [...otherActors].sort(() => Math.random() - 0.5).slice(0, confirmCount);
      for (const c of shuffled) {
        const isDispute = Math.random() < 0.12;
        await confirm(c, reportId, isDispute ? "DISPUTE" : "CONFIRM");
      }
      await recomputeAccuracy(reporter.orgId);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  ...${i + 1}/${REPORT_COUNT} reports generated`);
    }
  }

  console.log("seedBulk: running campaign correlation sweep…");
  await runCampaignCorrelation();

  console.log("seedBulk: complete.");
  console.log(`  ${actors.length} organizations, ${reportIds.length} reports`);
  console.log(`  demo login password for every bulk-seeded org: "${DEMO_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
