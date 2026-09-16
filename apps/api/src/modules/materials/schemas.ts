import { z } from "zod";

export const materialIdParamSchema = z.object({
  materialId: z.uuid(),
});

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_MIME_TYPES = ["application/pdf"] as const;
