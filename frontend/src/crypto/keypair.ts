import nacl from "tweetnacl";
import { encodeBase64, decodeBase64, decodeUTF8 } from "tweetnacl-util";
import { canonicalize } from "@sixsync/shared";
import type { SignableReportFields } from "@sixsync/shared";

export interface OrgKeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateKeyPair(): OrgKeyPair {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    privateKey: encodeBase64(kp.secretKey),
  };
}

export function signReportPayload(fields: SignableReportFields, privateKeyBase64: string): string {
  const message = decodeUTF8(canonicalize(fields));
  const secretKey = decodeBase64(privateKeyBase64);
  const signature = nacl.sign.detached(message, secretKey);
  return encodeBase64(signature);
}

export function downloadKeyFile(orgName: string, orgId: string, did: string, keyPair: OrgKeyPair) {
  const payload = { orgId, did, publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cyberchain-${orgName.replace(/\s+/g, "-").toLowerCase()}-keys.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
