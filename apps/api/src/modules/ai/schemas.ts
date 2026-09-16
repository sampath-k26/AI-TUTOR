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
