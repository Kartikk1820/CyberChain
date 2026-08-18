import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveIndicatorToIp } from "../plugins/intel/dnsResolution";

test("IP indicator resolves directly without any DNS lookup", async () => {
  const result = await resolveIndicatorToIp("198.51.100.42", "IP");
  assert.deepEqual(result, { ip: "198.51.100.42", via: "direct" });
});

test("HASH indicator has nothing to resolve", async () => {
  const result = await resolveIndicatorToIp("d41d8cd98f00b204e9800998ecf8427e", "HASH");
  assert.deepEqual(result, { ip: null, via: "unresolved" });
});

test("malformed URL resolves to unresolved rather than throwing", async () => {
  const result = await resolveIndicatorToIp("not a url", "URL");
  assert.deepEqual(result, { ip: null, via: "unresolved" });
});

test("known demo domain falls back to the hardcoded table when DNS can't be trusted in CI", async () => {
  // secure-login-verify.example is a reserved .example TLD (RFC 2606) — it will
  // never resolve via real DNS, so this deterministically exercises the fallback path.
  const result = await resolveIndicatorToIp("secure-login-verify.example", "DOMAIN");
  assert.deepEqual(result, { ip: "198.51.100.42", via: "fallback" });
});

test("unknown domain with no DNS and no fallback entry resolves to unresolved, never throws", async () => {
  const result = await resolveIndicatorToIp("this-domain-should-not-exist-sixsync-demo.invalid", "DOMAIN");
  assert.deepEqual(result, { ip: null, via: "unresolved" });
});
