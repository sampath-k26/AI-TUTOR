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

export const listProjectsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  spaceId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
