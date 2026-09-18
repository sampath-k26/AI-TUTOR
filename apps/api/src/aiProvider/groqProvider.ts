import Groq from "groq-sdk";
import { z } from "zod";
import { config } from "../core/config";
import { logAiUsage } from "../core/observability";
import {
  AiGenerationError,
  withRetry,
  type GenerateStructuredParams,
  type GenerateTextParams,
  type GenerateTextResult,
  type TextProvider,
} from "./base";

/**
 * Open-weight model served on Groq's free tier — used only for adaptive-quiz question
 * generation, where latency matters more than the extra reasoning depth Gemini provides
 * (decision D7). Never used for Tutor grounding/citation, embeddings, or document understanding.
 * llama-3.3-70b-versatile was retired from Groq's catalog (404 model_not_found) — verified
 * against GET /openai/v1/models that gpt-oss-120b is both available and advertises
 * "structured_outputs" support, which our generateStructured() relies on.
 */
const MODEL = "openai/gpt-oss-120b";

export class GroqProvider implements TextProvider {
  private client: Groq;

  constructor(apiKey: string = config.GROQ_API_KEY) {
    this.client = new Groq({ apiKey });
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const start = Date.now();
    try {
      const completion = await withRetry(() =>
        this.client.chat.completions.create({
          model: MODEL,
          messages: [
            ...(params.systemInstruction ? [{ role: "system" as const, content: params.systemInstruction }] : []),
            { role: "user" as const, content: params.prompt },
          ],
        }),
      );

      const text = completion.choices[0]?.message?.content ?? "";

      await logAiUsage({
        feature: params.feature,
        provider: "groq",
        model: MODEL,
        latencyMs: Date.now() - start,
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
        estimatedCostUsd: 0, // free tier
        success: true,
        relatedEntity: params.relatedEntity,
      });

      return { text };
    } catch (err) {
      await logAiUsage({
        feature: params.feature,
        provider: "groq",
        model: MODEL,
        latencyMs: Date.now() - start,
        success: false,
        errorDetail: err instanceof Error ? err.message : String(err),
        relatedEntity: params.relatedEntity,
      });
      throw new AiGenerationError("Groq text generation failed", "groq", err);
    }
  }

  async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T> {
    const start = Date.now();
    try {
      const completion = await withRetry(() =>
        this.client.chat.completions.create({
          model: MODEL,
          messages: [
            ...(params.systemInstruction ? [{ role: "system" as const, content: params.systemInstruction }] : []),
            { role: "user" as const, content: params.prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: params.schemaName,
              schema: z.toJSONSchema(params.schema) as Record<string, unknown>,
              strict: true,
            },
          },
        }),
      );

      const raw: unknown = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      // Never trust provider structured output blindly, even with strict mode requested.
      const parsed = params.schema.parse(raw);

      // Logged only after parsing succeeds — logging success first meant a
      // subsequent schema-validation failure produced a second, contradictory
      // failure row in ai_usage_log for the very same call.
      await logAiUsage({
        feature: params.feature,
        provider: "groq",
        model: MODEL,
        latencyMs: Date.now() - start,
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
        estimatedCostUsd: 0,
        success: true,
        relatedEntity: params.relatedEntity,
      });

      return parsed;
    } catch (err) {
      await logAiUsage({
        feature: params.feature,
        provider: "groq",
        model: MODEL,
        latencyMs: Date.now() - start,
        success: false,
        errorDetail: err instanceof Error ? err.message : String(err),
        relatedEntity: params.relatedEntity,
      });
      throw new AiGenerationError("Groq structured generation failed", "groq", err);
    }
  }
}
