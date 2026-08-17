import { prisma } from "../../db/prisma";
import type { RiskBreakdown } from "@sixsync/shared";

const WEIGHTS = {
  identity: 0.2,
  device: 0.15,
  location: 0.15,
  ipThreat: 0.35,
  behavior: 0.15,
};

const NORMAL_HOURS_START_UTC = 6;
const NORMAL_HOURS_END_UTC = 22;
const VELOCITY_WINDOW_MINUTES = 5;
const VELOCITY_THRESHOLD = 3;
const KNOWN_LOCATION_WINDOW_HOURS = 24 * 30;
const IMPOSSIBLE_TRAVEL_WINDOW_MINUTES = 60;
const BLOCKLISTED_DEVICE_FINGERPRINTS = new Set(["blocklisted-device"]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ipPrefix(ip: string): string {
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 2).join(".") : ip;
}

function computeIdentityRisk(passwordValid: boolean): number {
  return passwordValid ? 10 : 100;
}

async function computeDeviceRisk(organizationId: string, user: string, deviceFingerprint: string): Promise<number> {
  if (BLOCKLISTED_DEVICE_FINGERPRINTS.has(deviceFingerprint)) return 100;
  const seen = await prisma.accessAttempt.findFirst({
    where: { organizationId, user, deviceFingerprint },
  });
  return seen ? 5 : 60;
}

async function computeLocationRisk(organizationId: string, user: string, ip: string): Promise<number> {
  const lastAttempt = await prisma.accessAttempt.findFirst({
    where: { organizationId, user },
    orderBy: { createdAt: "desc" },
  });
  if (!lastAttempt) return 5;

  const withinKnownWindow = Date.now() - lastAttempt.createdAt.getTime() < KNOWN_LOCATION_WINDOW_HOURS * 60 * 60 * 1000;
  const samePrefix = ipPrefix(lastAttempt.ip) === ipPrefix(ip);

  if (samePrefix || !withinKnownWindow) return 5;

  const minutesSinceLast = (Date.now() - lastAttempt.createdAt.getTime()) / (1000 * 60);
  if (minutesSinceLast < IMPOSSIBLE_TRAVEL_WINDOW_MINUTES) return 90;
  return 50;
}

async function computeIpThreatRisk(ip: string): Promise<number> {
  const report = await prisma.threatReport.findFirst({
    where: { indicator: ip, indicatorType: "IP", status: { in: ["CONFIRMED", "CRITICAL"] } },
    include: { confidenceScore: true },
    orderBy: { confidenceScore: { score: "desc" } },
  });
  return report?.confidenceScore?.score ?? 0;
}

async function computeBehaviorRisk(organizationId: string, user: string): Promise<number> {
  let risk = 10;
  const hourUtc = new Date().getUTCHours();
  if (hourUtc < NORMAL_HOURS_START_UTC || hourUtc >= NORMAL_HOURS_END_UTC) risk += 30;

  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MINUTES * 60 * 1000);
  const recentCount = await prisma.accessAttempt.count({
    where: { organizationId, user, createdAt: { gte: windowStart } },
  });
  if (recentCount >= VELOCITY_THRESHOLD - 1) risk += 40;

  return clamp(risk, 0, 100);
}

export interface RiskEngineInput {
  organizationId: string;
  user: string;
  ip: string;
  deviceFingerprint: string;
  passwordValid: boolean;
}

export async function computeRiskBreakdown(input: RiskEngineInput): Promise<RiskBreakdown> {
  const [identityRisk, deviceRisk, locationRisk, ipThreatRisk, behaviorRisk] = await Promise.all([
    Promise.resolve(computeIdentityRisk(input.passwordValid)),
    computeDeviceRisk(input.organizationId, input.user, input.deviceFingerprint),
    computeLocationRisk(input.organizationId, input.user, input.ip),
    computeIpThreatRisk(input.ip),
    computeBehaviorRisk(input.organizationId, input.user),
  ]);

  const totalRiskScore = clamp(
    WEIGHTS.identity * identityRisk +
      WEIGHTS.device * deviceRisk +
      WEIGHTS.location * locationRisk +
      WEIGHTS.ipThreat * ipThreatRisk +
      WEIGHTS.behavior * behaviorRisk,
    0,
    100
  );

  return { identityRisk, deviceRisk, locationRisk, ipThreatRisk, behaviorRisk, totalRiskScore };
}
