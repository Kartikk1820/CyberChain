import type { FastifyInstance } from "fastify";
import { appendBlock, corruptBlock, getBlock, getBlockByRef, verifyChain } from "./chain";

const DEBUG_ENABLED = process.env.LEDGER_DEBUG_ENDPOINTS === "true";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "ledger" }));

  app.post<{ Body: { payload_hash: string; ref?: string } }>("/blocks", async (req, reply) => {
    const { payload_hash, ref } = req.body ?? ({} as { payload_hash: string; ref?: string });
    if (!payload_hash || typeof payload_hash !== "string") {
      return reply.code(400).send({ error: "payload_hash (string) is required" });
    }
    const block = appendBlock(payload_hash, ref ?? null);
    return reply.code(201).send(block);
  });

  app.get<{ Params: { idx: string } }>("/blocks/:idx", async (req, reply) => {
    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx)) return reply.code(400).send({ error: "idx must be an integer" });
    const block = getBlock(idx);
    if (!block) return reply.code(404).send({ error: "block not found" });
    return block;
  });

  app.get<{ Querystring: { ref: string } }>("/blocks/by-ref", async (req, reply) => {
    const { ref } = req.query;
    if (!ref) return reply.code(400).send({ error: "ref query param is required" });
    const block = getBlockByRef(ref);
    if (!block) return reply.code(404).send({ error: "no block found for ref" });
    return block;
  });

  app.get("/verify", async () => verifyChain());

  if (DEBUG_ENABLED) {
    app.post<{ Params: { idx: string } }>("/debug/corrupt-block/:idx", async (req, reply) => {
      const idx = Number(req.params.idx);
      if (!Number.isInteger(idx)) return reply.code(400).send({ error: "idx must be an integer" });
      const block = corruptBlock(idx);
      if (!block) return reply.code(404).send({ error: "block not found" });
      return { corrupted: true, block };
    });
  }
}
