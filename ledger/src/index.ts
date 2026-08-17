import Fastify from "fastify";
import { registerRoutes } from "./routes";

const PORT = Number(process.env.LEDGER_PORT ?? 4100);

async function main() {
  const app = Fastify({ logger: true });

  await registerRoutes(app);

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
