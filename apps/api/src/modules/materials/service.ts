import { randomUUID } from "node:crypto";
import { getProjectForOwner } from "../learning/service";
import { uploadMaterialFile } from "../../core/storage";
import { geminiProvider } from "../../aiProvider";
import { enqueueProcessMaterial } from "../../workers/processMaterial";
import * as repo from "./repository";
import type { RetrievedChunk } from "./repository";

export async function uploadMaterial(projectId: string, ownerId: string, file: Express.Multer.File) {
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) return undefined;

  const storagePath = `${projectId}/${randomUUID()}-${file.originalname}`;
  await uploadMaterialFile(storagePath, file.buffer, file.mimetype);

  const material = await repo.createQueuedMaterial(projectId, storagePath, file.originalname);
  if (material) {
    await enqueueProcessMaterial({ materialId: material.id, projectId, filePath: storagePath });
  }

  return material;
}

export async function listMaterials(projectId: string, ownerId: string) {
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) return undefined;
  return repo.listMaterialsForProject(projectId, ownerId);
}

export async function getMaterial(materialId: string, ownerId: string) {
  return repo.getMaterialForOwner(materialId, ownerId);
}

/** Used by other modules (e.g. ai) to render citations without querying the materials table directly. */
export async function getFilenamesByIds(materialIds: string[]) {
  return repo.getFilenamesByIds(materialIds);
}

/** Used by other modules (e.g. assessment, for question-generation prompts) instead of querying concepts directly. */
export async function getConceptById(conceptId: string) {
  return repo.getConceptById(conceptId);
}

/**
 * Generic semantic search over a project's material — the sole owner of read
 * access to material_chunks (see CLAUDE.md module-boundary rule). Callers (ai's
 * Tutor RAG, assessment's question-generation grounding) own their own
 * topK/threshold policy; this just embeds the query and searches.
 */
export async function searchRelevantChunks(
  projectId: string,
  queryText: string,
  options: { topK: number; similarityThreshold: number },
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await geminiProvider.embed({ text: queryText, feature: "embedding", relatedEntity: { projectId } });
  return repo.searchChunksByEmbedding(projectId, queryEmbedding, options.topK, options.similarityThreshold);
}
