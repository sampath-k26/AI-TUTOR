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

/**
 * Implemented by both providers (decision D7/D8). Every call to a provider method
 * must log to ai_usage_log itself (via core/observability.logAiUsage) — callers
 * never call the underlying SDK directly and never log on the provider's behalf.
 */
export interface TextProvider {
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T>;
}

/** Only Gemini implements this — see decision D7 (Groq has no embeddings in its free tier). */
export interface EmbeddingProvider {
  embed(params: EmbedParams): Promise<number[]>;
}

/** Only Gemini implements this — see decision D7 (Groq has no native vision/document understanding). */
export interface DocumentUnderstandingProvider {
  understandDocument(params: UnderstandDocumentParams): Promise<string>;
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
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") return RETRYABLE_STATUS_CODES.has(status);
  // Network-level failures (no HTTP status at all) are also worth retrying once or twice.
  return err instanceof Error && /network|timeout|ECONNRESET|ETIMEDOUT/i.test(err.message);
}

/**
 * PRD §13 explicitly calls out "AI timeouts, provider failures" as failure modes
 * requiring "reasonable timeouts, retries ... recovery mechanisms" — verified live
 * against a real transient Gemini 503 ("high demand") during development, which
 * is exactly the failure mode this exists to smooth over. Exponential backoff,
 * only for retryable (5xx/429/network) errors — a genuine 4xx (bad request,
 * invalid schema) fails immediately rather than retrying a request that can
 * never succeed.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = DEFAULT_MAX_ATTEMPTS): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
