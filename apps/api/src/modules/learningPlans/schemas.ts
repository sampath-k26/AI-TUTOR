import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});

export const stepIdParamSchema = z.object({
  stepId: z.uuid(),
});

export const setStepCompletedBodySchema = z.object({
  completed: z.boolean(),
});

export const learningPlanStepTypeSchema = z.enum(["material", "tutor", "quiz", "other"]);

/**
 * Gemini structured-output contract. relatedMaterialId/relatedConceptId are
 * `.nullable()` (always present, possibly null) rather than `.optional()` —
 * Gemini's JSON-schema-constrained mode is unreliable about actually omitting
 * an optional property, so the schema asks for null instead and the service
 * layer treats null and an unrecognized id the same way (dropped, not stored).
 */
export const learningPlanGenerationSchema = z.object({
  steps: z
    .array(
      z.object({
        type: learningPlanStepTypeSchema,
        description: z.string().min(1).max(300),
        relatedMaterialId: z.uuid().nullable(),
        relatedConceptId: z.uuid().nullable(),
      }),
    )
    .min(1)
    .max(12),
});
