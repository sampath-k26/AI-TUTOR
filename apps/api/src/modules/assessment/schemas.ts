import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});

export const quizIdParamSchema = z.object({
  quizId: z.uuid(),
});

export const questionIdParamSchema = z.object({
  questionId: z.uuid(),
});

export const submitAnswerBodySchema = z.object({
  answer: z.string().min(1).max(4000),
});

export const mcqGenerationSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
});

export const openEndedGenerationSchema = z.object({
  prompt: z.string().min(1),
  expectedKeyPoints: z.array(z.string().min(1)).min(1).max(6),
});

/**
 * Open-ended grading must explain what was understood vs. missing (PRD §7) —
 * never just a numeric score.
 */
export const openEndedGradingSchema = z.object({
  understanding: z.enum(["strong", "partial", "weak"]),
  accuracy: z.number().min(0).max(1),
  keyConceptsCovered: z.array(z.string()),
  missingConcepts: z.array(z.string()),
  feedbackText: z.string().min(1),
});
