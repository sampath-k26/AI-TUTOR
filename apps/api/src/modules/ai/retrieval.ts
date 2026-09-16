import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../core/db";
import { materialChunks } from "../../../db/schema";
import { geminiProvider } from "../../aiProvider";

export interface RetrievedChunk {
  id: string;
  materialId: string;
  pageNumber: number;
  content: string;
  similarity: number;
}

/**
 * Below this cosine similarity, retrieved context is treated as too weak to
 * ground an answer on (decision D11's evidence gate, PRD §7's "Enough Evidence?"
 * branch). A starting heuristic — recalibrate once real embeddings/documents are
 * available (see docs/06-IMPLEMENTATION-PLAN.md known simplifications).
 */
export const SIMILARITY_THRESHOLD = 0.5;
export const TOP_K = 6;

export async function retrieveRelevantChunks(projectId: string, query: string): Promise<RetrievedChunk[]> {
  const queryEmbedding = await geminiProvider.embed({ text: query, feature: "embedding", relatedEntity: { projectId } });

  const similarity = sql<number>`1 - (${cosineDistance(materialChunks.embedding, queryEmbedding)})`;

  const rows = await db
    .select({
      id: materialChunks.id,
      materialId: materialChunks.materialId,
      pageNumber: materialChunks.pageNumber,
      content: materialChunks.content,
      similarity,
    })
    .from(materialChunks)
    .where(and(eq(materialChunks.projectId, projectId), gt(similarity, SIMILARITY_THRESHOLD)))
    .orderBy((t) => desc(t.similarity))
    .limit(TOP_K);

  return rows;
}
