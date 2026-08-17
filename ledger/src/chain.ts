import crypto from "node:crypto";
import { db } from "./db";

export interface Block {
  idx: number;
  timestamp: string;
  payload_hash: string;
  ref: string | null;
  previous_hash: string;
  hash: string;
}

const GENESIS_PAYLOAD_HASH = sha256("SIXSYNC_GENESIS");
const GENESIS_PREVIOUS_HASH = "0".repeat(64);

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hashBlock(idx: number, timestamp: string, payloadHash: string, previousHash: string): string {
  return sha256(`${idx}|${timestamp}|${payloadHash}|${previousHash}`);
}

function getLatestBlock(): Block | undefined {
  return db.prepare("SELECT * FROM blocks ORDER BY idx DESC LIMIT 1").get() as Block | undefined;
}

function ensureGenesis(): Block {
  const existing = db.prepare("SELECT * FROM blocks WHERE idx = 0").get() as Block | undefined;
  if (existing) return existing;

  const timestamp = new Date().toISOString();
  const hash = hashBlock(0, timestamp, GENESIS_PAYLOAD_HASH, GENESIS_PREVIOUS_HASH);
  db.prepare(
    "INSERT INTO blocks (idx, timestamp, payload_hash, ref, previous_hash, hash) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(0, timestamp, GENESIS_PAYLOAD_HASH, null, GENESIS_PREVIOUS_HASH, hash);

  return db.prepare("SELECT * FROM blocks WHERE idx = 0").get() as Block;
}

ensureGenesis();

export function appendBlock(payloadHash: string, ref: string | null): Block {
  const latest = getLatestBlock() ?? ensureGenesis();
  const idx = latest.idx + 1;
  const timestamp = new Date().toISOString();
  const hash = hashBlock(idx, timestamp, payloadHash, latest.hash);

  db.prepare(
    "INSERT INTO blocks (idx, timestamp, payload_hash, ref, previous_hash, hash) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(idx, timestamp, payloadHash, ref, latest.hash, hash);

  return db.prepare("SELECT * FROM blocks WHERE idx = ?").get(idx) as Block;
}

export function getBlock(idx: number): Block | undefined {
  return db.prepare("SELECT * FROM blocks WHERE idx = ?").get(idx) as Block | undefined;
}

export function getBlockByRef(ref: string): Block | undefined {
  return db.prepare("SELECT * FROM blocks WHERE ref = ? ORDER BY idx DESC LIMIT 1").get(ref) as Block | undefined;
}

export interface VerifyResult {
  valid: boolean;
  blockCount: number;
  brokenAtIndex: number | null;
  reason: string | null;
}

export function verifyChain(): VerifyResult {
  const blocks = db.prepare("SELECT * FROM blocks ORDER BY idx ASC").all() as Block[];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const expectedPrevious = i === 0 ? GENESIS_PREVIOUS_HASH : blocks[i - 1].hash;

    if (block.previous_hash !== expectedPrevious) {
      return {
        valid: false,
        blockCount: blocks.length,
        brokenAtIndex: block.idx,
        reason: `block ${block.idx} previous_hash does not match hash of block ${block.idx - 1}`,
      };
    }

    const recomputed = hashBlock(block.idx, block.timestamp, block.payload_hash, block.previous_hash);
    if (recomputed !== block.hash) {
      return {
        valid: false,
        blockCount: blocks.length,
        brokenAtIndex: block.idx,
        reason: `block ${block.idx} stored hash does not match recomputed hash (content was altered)`,
      };
    }
  }

  return { valid: true, blockCount: blocks.length, brokenAtIndex: null, reason: null };
}

export function corruptBlock(idx: number): Block | undefined {
  const block = getBlock(idx);
  if (!block) return undefined;
  const corruptedPayloadHash = sha256(block.payload_hash + "TAMPERED");
  db.prepare("UPDATE blocks SET payload_hash = ? WHERE idx = ?").run(corruptedPayloadHash, idx);
  return getBlock(idx);
}
