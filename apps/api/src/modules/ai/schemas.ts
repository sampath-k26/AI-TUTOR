import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  conversationId: z.uuid().optional(),
});

export const citationSchema = z.object({
  materialId: z.string(),
  page: z.number().int().positive(),
});

/**
 * Structured output required from the model for every grounded answer (decision
 * D11). `citations` must be non-empty when `insufficientEvidence` is false — this
 * is enforced by the app after generation (see service.ts), not just requested
 * in the schema, since a model can still return an empty array despite the prompt.
 */
export const tutorResponseSchema = z.object({
  insufficientEvidence: z.boolean(),
  answer: z.string(),
  citations: z.array(citationSchema),
});
export type TutorResponse = z.infer<typeof tutorResponseSchema>;

/** Just the trailing JSON tail of a streamed answer (M9) — the streaming path gets
 * `answer` incrementally as tokens, so only these two fields are parsed from the tail. */
export const tutorStreamTailSchema = tutorResponseSchema.pick({ insufficientEvidence: true, citations: true });
export type TutorStreamTail = z.infer<typeof tutorStreamTailSchema>;

export type TutorCitation = { materialId: string; materialName: string; page: number };

/** Wire protocol for POST .../tutor/messages/stream — one JSON object per line
 * (newline-delimited), not a Zod schema since it's never parsed as untrusted input. */
export type TutorStreamEvent =
  | { type: "start"; conversationId: string }
  | { type: "token"; delta: string }
  | { type: "notice"; message: string }
  | { type: "done"; citations: TutorCitation[]; insufficientEvidence: boolean; groundingUncertain: boolean }
  | { type: "error"; message: string };
