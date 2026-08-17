import nacl from "tweetnacl";
import { canonicalReportPayload, type SignableReportFields } from "@sixsync/shared";

export function verifyReportSignature(fields: SignableReportFields, signatureBase64: string, publicKeyBase64: string): boolean {
  try {
    const message = Buffer.from(canonicalReportPayload(fields), "utf-8");
    const signature = Buffer.from(signatureBase64, "base64");
    const publicKey = Buffer.from(publicKeyBase64, "base64");
    if (signature.length !== nacl.sign.signatureLength) return false;
    if (publicKey.length !== nacl.sign.publicKeyLength) return false;
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}
