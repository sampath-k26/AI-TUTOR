import { z } from "zod";

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  theme: z.record(z.string(), z.unknown()).optional(),
});
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  learningGoal: z.string().min(1).max(2000),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const spaceIdParamSchema = z.object({
  spaceId: z.uuid(),
});

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});
