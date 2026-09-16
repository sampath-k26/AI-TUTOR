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

export async function insertChunks(materialId: string, projectId: string, chunks: Array<Chunk & { embedding: number[] }>) {
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

export async function insertConcepts(projectId: string, materialId: string, names: string[]) {
  if (names.length === 0) return;
  await db.insert(concepts).values(
    names.map((name) => ({
      projectId,
      name,
      sourceMaterialIds: [materialId],
    })),
  );
}

export async function getConceptById(conceptId: string) {
  const [concept] = await db.select().from(concepts).where(eq(concepts.id, conceptId)).limit(1);
  return concept;
}
