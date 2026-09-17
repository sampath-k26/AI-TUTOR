import { z } from "zod";

export const materialIdParamSchema = z.object({
  materialId: z.uuid(),
});

export const projectIdParamSchema = z.object({
  projectId: z.uuid(),
});

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_MIME_TYPES = ["application/pdf"] as const;

// Multer's fileFilter only sees the client-declared mimetype (trivially spoofable —
// e.g. curl's `;type=application/pdf` on a plain-text file), not the actual bytes,
// since it runs before the file is buffered. Every real PDF starts with this magic
// number regardless of what Content-Type the client claims — found live during a
// security pass (a spoofed-header upload sailed past the mimetype check).
const PDF_MAGIC_BYTES = "%PDF-";

export function hasPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_MAGIC_BYTES.length).toString("latin1") === PDF_MAGIC_BYTES;
}
