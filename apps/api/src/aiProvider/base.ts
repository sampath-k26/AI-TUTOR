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
