import { test } from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import { canonicalReportPayload, type SignableReportFields } from "@sixsync/shared";
import { verifyReportSignature } from "../plugins/trust/signature.service";

const fields: SignableReportFields = {
  reporterOrgId: "org-1",
  indicator: "1.2.3.4",
  indicatorType: "IP",
  attackType: "Phishing",
  mitreTechnique: "T1566",
  severity: "high",
  description: "Phishing infrastructure observed in the wild.",
  evidenceFileHash: "abc123",
  timestamp: "2026-08-17T00:00:00.000Z",
};

function sign(fields: SignableReportFields, secretKey: Uint8Array): string {
  const message = Buffer.from(canonicalReportPayload(fields), "utf-8");
  const sig = nacl.sign.detached(message, secretKey);
  return Buffer.from(sig).toString("base64");
}

test("valid signature verifies against the correct public key", () => {
  const kp = nacl.sign.keyPair();
  const signature = sign(fields, kp.secretKey);
  const publicKeyBase64 = Buffer.from(kp.publicKey).toString("base64");

  assert.equal(verifyReportSignature(fields, signature, publicKeyBase64), true);
});

test("signature fails verification against the wrong public key", () => {
  const signer = nacl.sign.keyPair();
  const impostor = nacl.sign.keyPair();
  const signature = sign(fields, signer.secretKey);
  const wrongPublicKey = Buffer.from(impostor.publicKey).toString("base64");

  assert.equal(verifyReportSignature(fields, signature, wrongPublicKey), false);
});

test("signature fails verification when payload is altered after signing", () => {
  const kp = nacl.sign.keyPair();
  const signature = sign(fields, kp.secretKey);
  const publicKeyBase64 = Buffer.from(kp.publicKey).toString("base64");

  const tamperedFields: SignableReportFields = { ...fields, indicator: "9.9.9.9" };
  assert.equal(verifyReportSignature(tamperedFields, signature, publicKeyBase64), false);
});

test("malformed signature/publicKey input does not throw and returns false", () => {
  assert.equal(verifyReportSignature(fields, "not-base64!!", "also-not-base64!!"), false);
});
