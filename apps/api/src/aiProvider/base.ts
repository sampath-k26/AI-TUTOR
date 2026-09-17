import type { ZodType } from "zod";
import type { AiFeature } from "../core/observability";

export interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  feature: AiFeature;
  relatedEntity?: Record<string, unknown>;
}

export interface GenerateTextResult {
  text: string;
}

export interface GenerateStructuredParams<T> {
  prompt: string;
  systemInstruction?: string;
  schema: ZodType<T>;
  /** a-z, A-Z, 0-9, underscores/dashes only — required by provider structured-output APIs */
  schemaName: string;
  feature: AiFeature;
  relatedEntity?: Record<string, unknown>;
}

export interface EmbedParams {
  text: string;
  feature: AiFeature;
  relatedEntity?: Record<string, unknown>;
}

export interface UnderstandDocumentParams {
  /** base64-encoded image bytes (e.g. a rendered PDF page) */
  imageBase64: string;
  mimeType: string;
  prompt: string;
  feature: AiFeature;
  relatedEntity?: Record<string, unknown>;
}

export interface UnderstandDocumentBatchParams {
  /** each entry rendered as its own image part, in order, preceded by a page marker */
  images: Array<{ pageNumber: number; imageBase64: string; mimeType: string }>;
  prompt: string;
  feature: AiFeature;
  relatedEntity?: Record<string, unknown>;
}

/**
 * Implemented by both providers (decision D7/D8). Every call to a provider method
 * must log to ai_usage_log itself (via core/observability.logAiUsage) — callers
 * never call the underlying SDK directly and never log on the provider's behalf.
 */
export interface TextProvider {
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T>;
}

/** Only Gemini implements this — plain-text token streaming for the Tutor (M9). Not
 * part of TextProvider since Groq (MCQ generation only) has no streaming need today. */
export interface StreamingTextProvider {
  generateTextStream(params: GenerateTextParams): AsyncGenerator<string>;
}

/** Only Gemini implements this — see decision D7 (Groq has no embeddings in its free tier). */
export interface EmbeddingProvider {
  embed(params: EmbedParams): Promise<number[]>;
}

/** Only Gemini implements this — see decision D7 (Groq has no native vision/document understanding). */
export interface DocumentUnderstandingProvider {
  understandDocument(params: UnderstandDocumentParams): Promise<string>;
  /** Raw model output for a batch of page images — caller parses per-page delimiters. */
  understandDocumentBatch(params: UnderstandDocumentBatchParams): Promise<string>;
}

export class AiGenerationError extends Error {
  constructor(
    message: string,
    public readonly provider: "gemini" | "groq",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiGenerationError";
  }
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;
// Free-tier 429s are rate-limit quota resets, not transient blips — Gemini's own
// error payload has said "Please retry in 5.5s" (observed live running the seed
// script's back-to-back AI calls against the free tier's 5 requests/minute/model
// cap). A sub-second backoff can't outlast that, so 429s get a much longer wait.
const RATE_LIMIT_BASE_DELAY_MS = 3_000;

function getStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

/**
 * A 429 whose quotaId contains "PerDay" is Gemini's free-tier *daily* cap (seen
 * live: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", limit 20/day for
 * gemini-3.6-flash) — distinct from the per-minute cap. No backoff within a
 * request's lifetime can outlast a 24h reset, so retrying it is pure waste:
 * every attempt fails identically and just delays surfacing the real error.
 */
function isDailyQuotaExhausted(err: unknown): boolean {
  return getStatus(err) === 429 && err instanceof Error && /PerDay/i.test(err.message);
}

function isRetryable(err: unknown): boolean {
  if (isDailyQuotaExhausted(err)) return false;
  const status = getStatus(err);
  if (typeof status === "number") return RETRYABLE_STATUS_CODES.has(status);
  // Network-level failures (no HTTP status at all) are also worth retrying once or twice.
  return err instanceof Error && /network|timeout|ECONNRESET|ETIMEDOUT/i.test(err.message);
}

/**
 * PRD §13 explicitly calls out "AI timeouts, provider failures" as failure modes
 * requiring "reasonable timeouts, retries ... recovery mechanisms" — verified live
 * against a real transient Gemini 503 ("high demand") and, separately, real 429
 * rate-limit exhaustion during development, which is exactly the failure mode
 * this exists to smooth over. Exponential backoff, only for retryable (5xx/429/
 * network) errors — a genuine 4xx (bad request, invalid schema) fails immediately
 * rather than retrying a request that can never succeed.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = DEFAULT_MAX_ATTEMPTS): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      const base = getStatus(err) === 429 ? RATE_LIMIT_BASE_DELAY_MS : BASE_DELAY_MS;
      await new Promise((resolve) => setTimeout(resolve, base * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
