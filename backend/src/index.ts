import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { env } from "./config/env";
import { registerTrustRoutes } from "./plugins/trust/routes";
import { registerIntelRoutes } from "./plugins/intel/routes";
import { registerDefenseRoutes } from "./plugins/defense/routes";
import { wsBus } from "./ws/broadcast";
import { startCampaignSweep } from "./worker/campaignSweep";
import type { WsEvent } from "@sixsync/shared";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(multipart);
  await app.register(websocket);

  app.get("/health", async () => ({ status: "ok", service: "backend" }));

  await app.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (socket) => {
      const listener = (event: WsEvent) => {
        socket.send(JSON.stringify(event));
      };
      wsBus.on("event", listener);
      socket.on("close", () => wsBus.off("event", listener));
    });
  });

  await registerTrustRoutes(app);
  await registerIntelRoutes(app);
  await registerDefenseRoutes(app);

  startCampaignSweep();

  await app.listen({ port: env.BACKEND_PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
