import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});

export const activityQuerySchema = z.object({
  category: z.enum(["projects", "spaces"]).default("projects"),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
