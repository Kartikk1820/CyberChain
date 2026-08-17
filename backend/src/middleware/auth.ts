import type { FastifyReply, FastifyRequest } from "fastify";

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "unauthorized" });
  }
}

export function currentOrgId(req: FastifyRequest): string {
  return (req.user as { orgId: string }).orgId;
}
