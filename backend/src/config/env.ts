import { z } from "zod";

const envSchema = z.object({
  BACKEND_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  LEDGER_URL: z.string().default("http://ledger:4100"),
  JWT_SECRET: z.string().default("dev_jwt_secret_change_me"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ENABLE_LLM_ENRICHMENT: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ENABLE_TI_ENRICHMENT: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  ABUSEIPDB_API_KEY: z.string().optional(),
  ENABLE_EMAIL_ALERTS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  ALERT_EMAIL_OVERRIDE: z.string().optional(),
});

export const env = envSchema.parse(process.env);
