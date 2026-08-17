import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.LEDGER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sixsync-ledger-test-"));

const chainModule = import("../chain");

test("genesis block is created automatically with index 0", async () => {
  const chain = await chainModule;
  const genesis = chain.getBlock(0);
  assert.ok(genesis);
  assert.equal(genesis!.previous_hash, "0".repeat(64));
});

test("appendBlock chains each block to the previous block's hash", async () => {
  const chain = await chainModule;
  const b1 = chain.appendBlock("hash-of-report-1", "report-1");
  const b2 = chain.appendBlock("hash-of-report-2", "report-2");

  assert.equal(b1.previous_hash, chain.getBlock(0)!.hash);
  assert.equal(b2.previous_hash, b1.hash);
  assert.equal(b2.idx, b1.idx + 1);
});

test("verifyChain reports valid on an untouched chain", async () => {
  const chain = await chainModule;
  chain.appendBlock("hash-of-report-3", "report-3");
  const result = chain.verifyChain();
  assert.equal(result.valid, true);
  assert.equal(result.brokenAtIndex, null);
});

test("corrupting a block's payload_hash is detected by verifyChain (chain-level tamper)", async () => {
  const chain = await chainModule;
  const block = chain.appendBlock("hash-of-report-4", "report-4");
  const before = chain.verifyChain();
  assert.equal(before.valid, true);

  chain.corruptBlock(block.idx);

  const after = chain.verifyChain();
  assert.equal(after.valid, false);
  assert.equal(after.brokenAtIndex, block.idx);
});

test("getBlockByRef finds the most recent block for a given report reference", async () => {
  const chain = await chainModule;
  const appended = chain.appendBlock("hash-of-report-5", "report-5");
  const found = chain.getBlockByRef("report-5");
  assert.ok(found);
  assert.equal(found!.idx, appended.idx);
});
