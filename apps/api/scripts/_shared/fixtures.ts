/**
 * Shared helpers for scripts that exercise the real pipeline end-to-end
 * (seed.ts, runEval.ts) — not part of the src/modules module system, so the
 * module-boundary rules in CLAUDE.md don't apply here; this is operational
 * tooling, not application code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import * as materialsService from "../../src/modules/materials/service";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Minimal hand-built single-page PDF (no external PDF library needed) — real embedded text, real xref table. */
export function buildDemoPdf(title: string, paragraphs: string[]): Buffer {
  const lines: string[] = [title, "", ...paragraphs.flatMap((p) => [...wrapText(p, 58), ""])];
  const textOps = lines
    .map((line, i) => (i === 0 ? `(${escapePdfText(line)}) Tj` : `0 -14 Td (${escapePdfText(line)}) Tj`))
    .join(" ");
  const stream = `BT /F1 11 Tf 20 480 Td ${textOps} ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 320 500] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [i, obj] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

export function buildFakeUploadFile(filename: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: filename,
    mimetype: "application/pdf",
    buffer,
    size: buffer.length,
  } as unknown as Express.Multer.File;
}

/**
 * Creates a pre-confirmed user via the service-role Admin API — bypasses
 * Supabase's public-signup domain validation and email rate limit entirely
 * (see CLAUDE.md "Environment variables / secrets"). Idempotent: returns the
 * existing user's id if this email was already registered by a previous run.
 */
export async function getOrCreateUser(supabaseAdmin: SupabaseClient, email: string, password: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error && data.user) return data.user.id;

  if (error?.message.toLowerCase().includes("already registered") || error?.message.toLowerCase().includes("already been registered")) {
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    const existing = listData.users.find((u) => u.email === email);
    if (!existing) throw new Error(`Could not find existing auth user for ${email}`);
    return existing.id;
  }

  throw error ?? new Error(`Failed to create user ${email}`);
}

const MATERIAL_READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

export async function waitForMaterialReady(materialId: string, ownerId: string): Promise<void> {
  const deadline = Date.now() + MATERIAL_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const material = await materialsService.getMaterial(materialId, ownerId);
    if (material?.status === "ready") return;
    if (material?.status === "failed") throw new Error(`Material processing failed: ${material.errorDetail}`);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Material ${materialId} did not become ready within ${MATERIAL_READY_TIMEOUT_MS}ms`);
}
