import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});
