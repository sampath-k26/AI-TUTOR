import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../core/db";
import { conversations, learningContext, materials, messages, projects } from "../../../db/schema";

const CONVERSATION_HISTORY_LIMIT = 10; // bounded window (PRD §6 — never resend full history)
const LEARNING_CONTEXT_LIMIT = 8;

export async function getProjectForOwner(projectId: string, ownerId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return project;
}

export async function getOrCreateConversation(projectId: string, conversationId: string | undefined) {
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.projectId, projectId)))
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db.insert(conversations).values({ projectId }).returning();
  return created;
}

export async function getRecentMessages(conversationId: string) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(CONVERSATION_HISTORY_LIMIT);
  return rows.reverse(); // chronological order for prompt assembly
}

export async function getRelevantLearningContext(projectId: string) {
  return db
    .select()
    .from(learningContext)
    .where(eq(learningContext.projectId, projectId))
    .orderBy(desc(learningContext.relevanceScore))
    .limit(LEARNING_CONTEXT_LIMIT);
}

export async function getMaterialFilenames(materialIds: string[]): Promise<Map<string, string>> {
  if (materialIds.length === 0) return new Map();
  const rows = await db
    .select({ id: materials.id, originalFilename: materials.originalFilename })
    .from(materials)
    .where(inArray(materials.id, materialIds));
  return new Map(rows.map((r) => [r.id, r.originalFilename]));
}

export async function saveMessage(params: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations?: unknown;
  confidence?: number;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
}) {
  const [message] = await db
    .insert(messages)
    .values({
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      citations: params.citations,
      confidence: params.confidence?.toString(),
      model: params.model,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      latencyMs: params.latencyMs,
    })
    .returning();
  return message;
}

export async function listConversationMessages(conversationId: string) {
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}
