import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../core/db";
import { concepts, growthSnapshots, mastery, questions, quizzes, responses } from "../../../db/schema";
import type { ConceptCandidate } from "./selection";

const RECENTLY_ASKED_LIMIT = 3;

export async function createQuiz(projectId: string) {
  const [quiz] = await db.insert(quizzes).values({ projectId }).returning();
  return quiz;
}

export async function getQuizForProject(quizId: string, projectId: string) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.projectId, projectId)))
    .limit(1);
  return quiz;
}

export async function completeQuiz(quizId: string) {
  await db.update(quizzes).set({ status: "completed", completedAt: new Date() }).where(eq(quizzes.id, quizId));
}

/** Every tracked concept for the project, left-joined to its current mastery (0 if none yet). */
export async function getConceptCandidates(projectId: string): Promise<ConceptCandidate[]> {
  const rows = await db
    .select({
      conceptId: concepts.id,
      masteryLevel: mastery.level,
      lastEvidenceAt: mastery.lastEvidenceAt,
    })
    .from(concepts)
    .leftJoin(mastery, eq(mastery.conceptId, concepts.id))
    .where(eq(concepts.projectId, projectId));

  return rows.map((r) => ({
    conceptId: r.conceptId,
    masteryLevel: r.masteryLevel ? Number(r.masteryLevel) : 0,
    lastEvidenceAt: r.lastEvidenceAt,
  }));
}

export async function getRecentlyAskedConceptIds(quizId: string): Promise<string[]> {
  const rows = await db
    .select({ conceptId: questions.conceptId })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(desc(questions.createdAt))
    .limit(RECENTLY_ASKED_LIMIT);
  return rows.map((r) => r.conceptId);
}

export async function createQuestion(params: {
  quizId: string;
  conceptId: string;
  type: "mcq" | "open_ended";
  difficulty: number;
  prompt: string;
  options?: unknown;
  answerKey: unknown;
  generatedBy: "gemini" | "groq";
}) {
  const [question] = await db.insert(questions).values(params).returning();
  return question;
}

export async function getQuestionForProject(questionId: string, projectId: string) {
  const [row] = await db
    .select({ question: questions })
    .from(questions)
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .where(and(eq(questions.id, questionId), eq(quizzes.projectId, projectId)))
    .limit(1);
  return row?.question;
}

export async function createResponse(params: {
  questionId: string;
  userAnswer: string;
  isCorrect?: boolean;
  evaluation?: unknown;
  score: number;
}) {
  const [response] = await db
    .insert(responses)
    .values({
      questionId: params.questionId,
      userAnswer: params.userAnswer,
      isCorrect: params.isCorrect,
      evaluation: params.evaluation,
      score: params.score.toString(),
    })
    .returning();
  return response;
}

export async function getMasteryState(projectId: string, conceptId: string) {
  const [row] = await db
    .select()
    .from(mastery)
    .where(and(eq(mastery.projectId, projectId), eq(mastery.conceptId, conceptId)))
    .limit(1);
  return row;
}

export async function upsertMastery(params: {
  projectId: string;
  conceptId: string;
  level: number;
  evidenceCount: number;
  lastEvidenceAt: Date;
}) {
  await db
    .insert(mastery)
    .values({
      projectId: params.projectId,
      conceptId: params.conceptId,
      level: params.level.toString(),
      evidenceCount: params.evidenceCount,
      lastEvidenceAt: params.lastEvidenceAt,
    })
    .onConflictDoUpdate({
      target: [mastery.projectId, mastery.conceptId],
      set: {
        level: params.level.toString(),
        evidenceCount: params.evidenceCount,
        lastEvidenceAt: params.lastEvidenceAt,
        updatedAt: sql`now()`,
      },
    });
}

export async function insertGrowthSnapshot(params: {
  projectId: string;
  conceptId: string;
  level: number;
  trend: "improving" | "stable" | "requires_attention";
  evidenceRef: unknown;
}) {
  await db.insert(growthSnapshots).values({
    projectId: params.projectId,
    conceptId: params.conceptId,
    level: params.level.toString(),
    trend: params.trend,
    evidenceRef: params.evidenceRef,
  });
}
