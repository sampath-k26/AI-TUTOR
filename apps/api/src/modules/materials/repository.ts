import { and, cosineDistance, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../../core/db";
import { concepts, materialChunks, materials, projects } from "../../../db/schema";
import type { Chunk } from "./processing/chunking";

export interface RetrievedChunk {
  id: string;
  materialId: string;
  pageNumber: number;
  content: string;
  similarity: number;
}

/** Scoped by ownerId via a join to projects (defense layer 1 of decision D16). */
export async function getMaterialForOwner(materialId: string, ownerId: string) {
  const [row] = await db
    .select({ material: materials })
    .from(materials)
    .innerJoin(projects, eq(materials.projectId, projects.id))
    .where(and(eq(materials.id, materialId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return row?.material;
}

export async function listMaterialsForProject(projectId: string, ownerId: string) {
  const rows = await db
    .select({ material: materials })
    .from(materials)
    .innerJoin(projects, eq(materials.projectId, projects.id))
    .where(and(eq(materials.projectId, projectId), eq(projects.ownerId, ownerId)));
  return rows.map((r) => r.material);
}

export async function createQueuedMaterial(projectId: string, filePath: string, originalFilename: string) {
  const [material] = await db
    .insert(materials)
    .values({ projectId, filePath, originalFilename, status: "queued" })
    .returning();
  return material;
}

export async function markProcessing(materialId: string) {
  await db.update(materials).set({ status: "processing" }).where(eq(materials.id, materialId));
}

export async function markReady(materialId: string, pageCount: number) {
  await db
    .update(materials)
    .set({ status: "ready", pageCount, processedAt: new Date() })
    .where(eq(materials.id, materialId));
}

export async function markFailed(materialId: string, errorDetail: string) {
  await db.update(materials).set({ status: "failed", errorDetail }).where(eq(materials.id, materialId));
}

/**
 * Deletes any chunks already stored for this material before inserting the
 * freshly-embedded set — makes the write idempotent under pg-boss's
 * at-least-once delivery (a redelivered processMaterial job re-embeds from
 * scratch; without this it would silently double up every chunk, degrading
 * Tutor retrieval with duplicate context rather than failing loudly).
 */
export async function insertChunks(materialId: string, projectId: string, chunks: Array<Chunk & { embedding: number[] }>) {
  await db.delete(materialChunks).where(eq(materialChunks.materialId, materialId));
  if (chunks.length === 0) return;
  await db.insert(materialChunks).values(
    chunks.map((c) => ({
      materialId,
      projectId,
      pageNumber: c.pageNumber,
      content: c.content,
      embedding: c.embedding,
    })),
  );
}

export async function listConceptNamesForProject(projectId: string): Promise<string[]> {
  const rows = await db.select({ name: concepts.name }).from(concepts).where(eq(concepts.projectId, projectId));
  return rows.map((r) => r.name);
}

/** Vector similarity search — the sole owner of read access to material_chunks (see CLAUDE.md module-boundary rule). */
export async function searchChunksByEmbedding(
  projectId: string,
  queryEmbedding: number[],
  topK: number,
  similarityThreshold: number,
): Promise<RetrievedChunk[]> {
  const similarity = sql<number>`1 - (${cosineDistance(materialChunks.embedding, queryEmbedding)})`;

  return db
    .select({
      id: materialChunks.id,
      materialId: materialChunks.materialId,
      pageNumber: materialChunks.pageNumber,
      content: materialChunks.content,
      similarity,
    })
    .from(materialChunks)
    .where(and(eq(materialChunks.projectId, projectId), gt(similarity, similarityThreshold)))
    .orderBy((t) => desc(t.similarity))
    .limit(topK);
}

export async function getFilenamesByIds(materialIds: string[]): Promise<Map<string, string>> {
  if (materialIds.length === 0) return new Map();
  const rows = await db
    .select({ id: materials.id, originalFilename: materials.originalFilename })
    .from(materials)
    .where(inArray(materials.id, materialIds));
  return new Map(rows.map((r) => [r.id, r.originalFilename]));
}

export async function insertConcepts(
  projectId: string,
  materialId: string,
  newConcepts: Array<{ name: string; description: string }>,
) {
  // Idempotency: unlike insertChunks (delete-then-insert by materialId), this had
  // no guard at all — a pg-boss redelivery of the same processMaterial job would
  // re-run extraction and insert a second full set of duplicate concept rows,
  // relying only on the extraction prompt's soft "don't propose near-duplicates"
  // nudge. Delete only concepts *exclusively* sourced from this material (not
  // ones later reinforced by a different material too) before re-inserting, so a
  // redelivery of this exact material's processing is safe without disturbing
  // concepts genuinely shared across materials. Found via code audit.
  await db.delete(concepts).where(
    and(eq(concepts.projectId, projectId), sql`${concepts.sourceMaterialIds} = ARRAY[${materialId}]::uuid[]`),
  );

  if (newConcepts.length === 0) return;
  await db.insert(concepts).values(
    newConcepts.map(({ name, description }) => ({
      projectId,
      name,
      description,
      sourceMaterialIds: [materialId],
    })),
  );
}

export async function getConceptById(conceptId: string) {
  const [concept] = await db.select().from(concepts).where(eq(concepts.id, conceptId)).limit(1);
  return concept;
}

export async function getConceptsByIds(conceptIds: string[]): Promise<Map<string, { name: string }>> {
  if (conceptIds.length === 0) return new Map();
  const rows = await db.select({ id: concepts.id, name: concepts.name }).from(concepts).where(inArray(concepts.id, conceptIds));
  return new Map(rows.map((r) => [r.id, { name: r.name }]));
}

export async function listConceptsForProject(projectId: string) {
  return db.select().from(concepts).where(eq(concepts.projectId, projectId));
}

/** Chunk text only (no embeddings/metadata) — feeds the concept map's live
 * co-occurrence computation (M12). */
export async function listChunkContentsForProject(projectId: string): Promise<string[]> {
  const rows = await db.select({ content: materialChunks.content }).from(materialChunks).where(eq(materialChunks.projectId, projectId));
  return rows.map((r) => r.content);
}
