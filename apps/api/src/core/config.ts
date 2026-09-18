import "dotenv/config";
import { z } from "zod";

/**
 * Fails fast at boot if a required env var is missing, instead of surfacing
 * a confusing failure later (e.g. mid-request when a provider client is first used).
 * AI provider keys are optional at boot: the app must run (and its non-AI routes must
 * work) before real credentials exist — see CLAUDE.md "Environment variables / secrets".
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Deployment-only escape hatch: some hosts (e.g. Render's free tier) don't offer
  // a separate Background Worker service type. When true, main.ts also registers
  // the pg-boss workers in-process instead of relying on `npm run worker` as a
  // second process. Local dev/test keep the two processes separate (this stays
  // false) — see src/workers/runWorker.ts for why that split exists.
  // Not z.coerce.boolean(): that coerces via JS's `Boolean(str)`, so the literal
  // string "false" would incorrectly coerce to `true` (any non-empty string does).
  RUN_WORKER_IN_API_PROCESS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // Defaults to the local docker-compose Postgres so the app is runnable before
  // real Supabase credentials exist (see CLAUDE.md "Environment variables / secrets").
  DATABASE_URL: z.string().min(1).default("postgresql://ai_tutor:ai_tutor_dev_password@localhost:5432/ai_tutor_dev"),

  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_ANON_KEY: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("materials"),

  GEMINI_API_KEY: z.string().optional().default(""),
  GROQ_API_KEY: z.string().optional().default(""),

  LANGFUSE_PUBLIC_KEY: z.string().optional().default(""),
  LANGFUSE_SECRET_KEY: z.string().optional().default(""),
  LANGFUSE_BASE_URL: z.string().optional().default("https://cloud.langfuse.com"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — see errors above");
}

export const config = parsed.data;

export const isAiConfigured = {
  gemini: config.GEMINI_API_KEY.length > 0,
  groq: config.GROQ_API_KEY.length > 0,
  supabase: config.SUPABASE_URL.length > 0 && config.SUPABASE_SERVICE_ROLE_KEY.length > 0,
  langfuse: config.LANGFUSE_PUBLIC_KEY.length > 0 && config.LANGFUSE_SECRET_KEY.length > 0,
};
