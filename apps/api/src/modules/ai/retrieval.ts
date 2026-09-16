import { searchRelevantChunks } from "../materials/service";

export type { RetrievedChunk } from "../materials/repository";

/**
 * Below this cosine similarity, retrieved context is treated as too weak to
 * ground an answer on (decision D11's evidence gate, PRD §7's "Enough Evidence?"
 * branch). A starting heuristic — recalibrate once real embeddings/documents are
 * available (see docs/06-IMPLEMENTATION-PLAN.md known simplifications).
 *
 * The actual material_chunks query lives in materials/repository.ts (materials
 * owns that table); this module owns the Tutor's grounding *policy* — how many
 * chunks, how strict the similarity floor — per decision D11.
 */
export const SIMILARITY_THRESHOLD = 0.5;
export const TOP_K = 6;

export async function retrieveRelevantChunks(projectId: string, query: string) {
  return searchRelevantChunks(projectId, query, { topK: TOP_K, similarityThreshold: SIMILARITY_THRESHOLD });
}
