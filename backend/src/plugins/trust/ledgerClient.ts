import { env } from "../../config/env";

export interface LedgerBlock {
  idx: number;
  timestamp: string;
  payload_hash: string;
  ref: string | null;
  previous_hash: string;
  hash: string;
}

export interface LedgerVerifyResult {
  valid: boolean;
  blockCount: number;
  brokenAtIndex: number | null;
  reason: string | null;
}

export async function appendLedgerBlock(payloadHash: string, ref: string): Promise<LedgerBlock> {
  const res = await fetch(`${env.LEDGER_URL}/blocks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload_hash: payloadHash, ref }),
  });
  if (!res.ok) {
    throw new Error(`ledger append failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as LedgerBlock;
}

export async function getLedgerBlock(idx: number): Promise<LedgerBlock | null> {
  const res = await fetch(`${env.LEDGER_URL}/blocks/${idx}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ledger get block failed: ${res.status}`);
  return (await res.json()) as LedgerBlock;
}

export async function verifyLedgerChain(): Promise<LedgerVerifyResult> {
  const res = await fetch(`${env.LEDGER_URL}/verify`);
  if (!res.ok) throw new Error(`ledger verify failed: ${res.status}`);
  return (await res.json()) as LedgerVerifyResult;
}
