import { db } from "./db";
import { aiUsageLog } from "../../db/schema";

export type AiFeature =
  | "tutor"
  | "quiz_generation"
  | "grading"
  | "recommendation"
  | "document_understanding"
  | "embedding"
  | "eval";

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
 * Source of truth for the Admin Dashboard's "AI usage"/"AI evaluation" views (decision D14).
 * Fire-and-forget: a logging failure must never break the user-facing AI response.
 * Langfuse mirroring (trace-level debugging) is layered on top of this in a later milestone —
 * this function is the one place that would call it, so it stays a single integration point.
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
}
