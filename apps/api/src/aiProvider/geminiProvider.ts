import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";
import { config } from "../core/config";
import { logAiUsage } from "../core/observability";
import {
  AiGenerationError,
  withRetry,
  type DocumentUnderstandingProvider,
  type EmbeddingProvider,
  type EmbedParams,
  type GenerateStructuredParams,
  type GenerateTextParams,
  type GenerateTextResult,
  type TextProvider,
  type UnderstandDocumentParams,
} from "./base";
import { EMBEDDING_DIMENSIONS } from "../../db/schema";

// gemini-2.5-flash was retired for new API keys — discovered via our own
// ai_usage_log error_detail (the API's 404 pointed straight at the replacement),
// exactly the kind of "why did this fail" investigation decision D14 exists for.
export const TEXT_MODEL = "gemini-3.6-flash";
const EMBEDDING_MODEL = "gemini-embedding-001";

/**
 * Approximate published per-token pricing (USD per 1M tokens) for cost *estimation* only.
 * We run on Gemini's free tier (decision A1) so actual billed cost is $0 — this exists so
 * ai_usage_log.estimated_cost_usd is still meaningful if/when a paid tier is ever used,
 * per the PRD's "how much did a request cost" observability requirement.
 */
const PRICE_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 0.3, output: 2.5 },
  "gemini-embedding-001": { input: 0.15, output: 0 },
};

function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const rate = PRICE_PER_MILLION_TOKENS_USD[model];
  if (!rate) return 0;
  return (tokensIn / 1_000_000) * rate.input + (tokensOut / 1_000_000) * rate.output;
}

export class GeminiProvider implements TextProvider, EmbeddingProvider, DocumentUnderstandingProvider {
  private client: GoogleGenAI;

  constructor(apiKey: string = config.GEMINI_API_KEY) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const start = Date.now();
    try {
      const response = await withRetry(() =>
        this.client.models.generateContent({
          model: TEXT_MODEL,
          contents: params.prompt,
          config: params.systemInstruction ? { systemInstruction: params.systemInstruction } : undefined,
        }),
      );

      const text = response.text ?? "";
      const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
      const tokensOut = response.usageMetadata?.candidatesTokenCount ?? 0;

      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: TEXT_MODEL,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        estimatedCostUsd: estimateCostUsd(TEXT_MODEL, tokensIn, tokensOut),
        success: true,
        relatedEntity: params.relatedEntity,
      });

      return { text };
    } catch (err) {
      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: TEXT_MODEL,
        latencyMs: Date.now() - start,
        success: false,
        errorDetail: err instanceof Error ? err.message : String(err),
        relatedEntity: params.relatedEntity,
      });
      throw new AiGenerationError("Gemini text generation failed", "gemini", err);
    }
  }

  async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T> {
    const start = Date.now();
    try {
      const response = await withRetry(() =>
        this.client.models.generateContent({
          model: TEXT_MODEL,
          contents: params.prompt,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(params.schema as unknown as ZodType),
          },
        }),
      );

      const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
      const tokensOut = response.usageMetadata?.candidatesTokenCount ?? 0;

      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: TEXT_MODEL,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        estimatedCostUsd: estimateCostUsd(TEXT_MODEL, tokensIn, tokensOut),
        success: true,
        relatedEntity: params.relatedEntity,
      });

      const raw: unknown = JSON.parse(response.text ?? "{}");
      // Never trust provider structured output blindly — validate against our own schema
      // even though we asked for it (decision D11's "never trust the model's claim blindly"
      // applies to all structured output, not just citations).
      return params.schema.parse(raw);
    } catch (err) {
      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: TEXT_MODEL,
        latencyMs: Date.now() - start,
        success: false,
        errorDetail: err instanceof Error ? err.message : String(err),
        relatedEntity: params.relatedEntity,
      });
      throw new AiGenerationError("Gemini structured generation failed", "gemini", err);
    }
  }

  async embed(params: EmbedParams): Promise<number[]> {
    const start = Date.now();
    try {
      const response = await withRetry(() =>
        this.client.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: params.text,
          config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        }),
      );

      const values = response.embeddings?.[0]?.values ?? [];

      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: EMBEDDING_MODEL,
        latencyMs: Date.now() - start,
        tokensIn: params.text.length,
        success: true,
        relatedEntity: params.relatedEntity,
      });

      return values;
    } catch (err) {
      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: EMBEDDING_MODEL,
        latencyMs: Date.now() - start,
        success: false,
        errorDetail: err instanceof Error ? err.message : String(err),
        relatedEntity: params.relatedEntity,
      });
      throw new AiGenerationError("Gemini embedding failed", "gemini", err);
    }
  }

  async understandDocument(params: UnderstandDocumentParams): Promise<string> {
    const start = Date.now();
    try {
      const response = await withRetry(() =>
        this.client.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            {
              role: "user",
              parts: [{ text: params.prompt }, { inlineData: { data: params.imageBase64, mimeType: params.mimeType } }],
            },
          ],
        }),
      );

      const text = response.text ?? "";
      const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
      const tokensOut = response.usageMetadata?.candidatesTokenCount ?? 0;

      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: TEXT_MODEL,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        estimatedCostUsd: estimateCostUsd(TEXT_MODEL, tokensIn, tokensOut),
        success: true,
        relatedEntity: params.relatedEntity,
      });

      return text;
    } catch (err) {
      await logAiUsage({
        feature: params.feature,
        provider: "gemini",
        model: TEXT_MODEL,
        latencyMs: Date.now() - start,
        success: false,
        errorDetail: err instanceof Error ? err.message : String(err),
        relatedEntity: params.relatedEntity,
      });
      throw new AiGenerationError("Gemini document understanding failed", "gemini", err);
    }
  }
}
