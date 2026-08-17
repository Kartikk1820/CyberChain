import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma";
import type { OrgType } from "@sixsync/shared";

export interface RegisterOrgInput {
  name: string;
  type: OrgType;
  publicKey: string;
  email: string;
  password: string;
}

export async function registerOrganization(input: RegisterOrgInput) {
  const did = `did:sixsync:${crypto.randomUUID()}`;
  const passwordHash = await bcrypt.hash(input.password, 10);

  const organization = await prisma.organization.create({
    data: {
      name: input.name,
      type: input.type,
      did,
      publicKey: input.publicKey,
      keyPair: {
        create: {
          publicKey: input.publicKey,
          generationMode: "client",
        },
      },
      user: {
        create: {
          email: input.email,
          passwordHash,
        },
      },
      securityPolicy: {
        create: {
          rules: {
            thresholds: { allow: 25, mfa: 50, restrict: 75 },
            overrides: [
              { if: "ipThreatRisk >= 90", then: "BLOCK", reason: "high-confidence known-malicious IP" },
            ],
          },
        },
      },
    },
    include: { user: true },
  });

  return organization;
}

export async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { organization: true } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user.organization;
}
