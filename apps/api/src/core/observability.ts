import { Langfuse } from "langfuse";
import { db } from "./db";
import { aiUsageLog } from "../../db/schema";
import { config, isAiConfigured } from "./config";

export type AiFeature =
  | "tutor"
  | "quiz_generation"
  | "grading"
  | "recommendation"
  | "document_understanding"
  | "embedding"
  | "eval"
  | "learning_plan";

export interface AiUsageRecord {
  feature: AiFeature;
  provider: "gemini" | "groq";
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCostUsd?: number;
  success: boolean;
  errorDetail?: string;
  relatedEntity?: Record<string, unknown>;
}

/**
 * Lazily constructed for the same reason as core/storage.ts/core/auth.ts: must not
 * throw at import time before real credentials exist. Langfuse Cloud is explicitly
 * "supplementary" (CLAUDE.md's locked stack) — ai_usage_log stays the source of
 * truth the Admin Dashboard reads from; this is a mirror for trace-level debugging
 * only, so it must never be allowed to affect request behavior either way.
 */
let langfuseClient: Langfuse | null = null;

function getLangfuseClient(): Langfuse | null {
  if (!isAiConfigured.langfuse) return null;
  langfuseClient ??= new Langfuse({
    publicKey: config.LANGFUSE_PUBLIC_KEY,
    secretKey: config.LANGFUSE_SECRET_KEY,
    baseUrl: config.LANGFUSE_BASE_URL,
  });
  return langfuseClient;
}

function mirrorToLangfuse(record: AiUsageRecord): void {
  const client = getLangfuseClient();
  if (!client) return;

  try {
    const trace = client.trace({ name: record.feature, metadata: record.relatedEntity });
    trace.generation({
      name: record.feature,
      model: record.model,
      usage: { input: record.tokensIn, output: record.tokensOut, unit: "TOKENS" },
      level: record.success ? "DEFAULT" : "ERROR",
      statusMessage: record.errorDetail,
      metadata: { provider: record.provider, estimatedCostUsd: record.estimatedCostUsd, latencyMs: record.latencyMs },
    });
  } catch (err) {
    console.error("Failed to mirror AI usage to Langfuse (non-fatal):", err);
  }
}

/**
 * Source of truth for the Admin Dashboard's "AI usage"/"AI evaluation" views (decision D14).
 * Fire-and-forget: a logging failure must never break the user-facing AI response.
 */
export async function logAiUsage(record: AiUsageRecord): Promise<void> {
  try {
    await db.insert(aiUsageLog).values({
      feature: record.feature,
      provider: record.provider,
      model: record.model,
      latencyMs: record.latencyMs,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      estimatedCostUsd: record.estimatedCostUsd?.toString(),
      success: record.success,
      errorDetail: record.errorDetail,
      relatedEntity: record.relatedEntity,
    });
  } catch (err) {
    console.error("Failed to write ai_usage_log record (non-fatal):", err);
  }

  mirrorToLangfuse(record);
}
