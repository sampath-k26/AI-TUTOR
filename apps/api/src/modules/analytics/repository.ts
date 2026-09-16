import { count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../core/db";
import { aiUsageLog, events, growthSnapshots, materials, mastery, projects, questions, quizzes, responses } from "../../../db/schema";

/**
 * Direct multi-table reads are the documented exception for this module (see
 * docs/03-ARCHITECTURE.md's module table: "analytics ... reads from all
 * modules' tables (read-only)") — unlike every other module, which must go
 * through another module's service. Authorization is still enforced in
 * analytics/service.ts via learning.getProjectForOwner before any of these
 * run; the exception is about which tables may be queried, not about
 * skipping ownership checks.
 */

export async function getProjectEventCounts(projectId: string): Promise<Array<{ type: string; count: number }>> {
  const rows = await db
    .select({ type: events.type, count: count() })
    .from(events)
    .where(eq(events.projectId, projectId))
    .groupBy(events.type);
  return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
}

export async function getProjectAssessmentStats(projectId: string) {
  const [quizStats] = await db
    .select({
      totalQuizzes: count(),
      completedQuizzes: sql<number>`count(*) filter (where ${quizzes.status} = 'completed')`,
    })
    .from(quizzes)
    .where(eq(quizzes.projectId, projectId));

  const [responseStats] = await db
    .select({
      totalAnswered: count(),
      correctCount: sql<number>`count(*) filter (where ${responses.isCorrect} = true)`,
      avgScore: sql<number | null>`avg(${responses.score})`,
    })
    .from(responses)
    .innerJoin(questions, eq(responses.questionId, questions.id))
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .where(eq(quizzes.projectId, projectId));

  return {
    totalQuizzes: Number(quizStats?.totalQuizzes ?? 0),
    completedQuizzes: Number(quizStats?.completedQuizzes ?? 0),
    totalQuestionsAnswered: Number(responseStats?.totalAnswered ?? 0),
    correctCount: Number(responseStats?.correctCount ?? 0),
    averageScore: responseStats?.avgScore != null ? Number(responseStats.avgScore) : null,
  };
}

export async function getProjectMasterySummary(projectId: string) {
  const [masteryStats] = await db
    .select({ conceptCount: count(), avgLevel: sql<number | null>`avg(${mastery.level})` })
    .from(mastery)
    .where(eq(mastery.projectId, projectId));

  // Latest trend per concept, reduced in JS (same approach as assessment/repository.ts).
  const snapshotRows = await db
    .select({ conceptId: growthSnapshots.conceptId, trend: growthSnapshots.trend, createdAt: growthSnapshots.createdAt })
    .from(growthSnapshots)
    .where(eq(growthSnapshots.projectId, projectId))
    .orderBy(sql`${growthSnapshots.createdAt} desc`);

  const latestTrendByConcept = new Map<string, string>();
  for (const row of snapshotRows) {
    if (!latestTrendByConcept.has(row.conceptId)) latestTrendByConcept.set(row.conceptId, row.trend);
  }

  const trendCounts = { improving: 0, stable: 0, requires_attention: 0 };
  for (const trend of latestTrendByConcept.values()) {
    if (trend in trendCounts) trendCounts[trend as keyof typeof trendCounts]++;
  }

  return {
    conceptCount: Number(masteryStats?.conceptCount ?? 0),
    averageMastery: masteryStats?.avgLevel != null ? Number(masteryStats.avgLevel) : null,
    trendCounts,
  };
}

export async function getProjectAiUsageSummary(projectId: string) {
  const [stats] = await db
    .select({
      callCount: count(),
      successCount: sql<number>`count(*) filter (where ${aiUsageLog.success} = true)`,
      totalTokensIn: sql<number | null>`sum(${aiUsageLog.tokensIn})`,
      totalTokensOut: sql<number | null>`sum(${aiUsageLog.tokensOut})`,
      totalCostUsd: sql<number | null>`sum(${aiUsageLog.estimatedCostUsd})`,
      avgLatencyMs: sql<number | null>`avg(${aiUsageLog.latencyMs})`,
    })
    .from(aiUsageLog)
    .where(sql`${aiUsageLog.relatedEntity} ->> 'projectId' = ${projectId}`);

  return {
    callCount: Number(stats?.callCount ?? 0),
    successCount: Number(stats?.successCount ?? 0),
    totalTokensIn: stats?.totalTokensIn != null ? Number(stats.totalTokensIn) : 0,
    totalTokensOut: stats?.totalTokensOut != null ? Number(stats.totalTokensOut) : 0,
    totalCostUsd: stats?.totalCostUsd != null ? Number(stats.totalCostUsd) : 0,
    averageLatencyMs: stats?.avgLatencyMs != null ? Number(stats.avgLatencyMs) : null,
  };
}

export async function getGlobalEventCounts(ownerId: string): Promise<Array<{ type: string; count: number }>> {
  const rows = await db
    .select({ type: events.type, count: count() })
    .from(events)
    .where(eq(events.userId, ownerId))
    .groupBy(events.type);
  return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
}

export async function getGlobalMasterySummary(ownerId: string) {
  const [stats] = await db
    .select({ conceptCount: count(), avgLevel: sql<number | null>`avg(${mastery.level})` })
    .from(mastery)
    .innerJoin(projects, eq(mastery.projectId, projects.id))
    .where(eq(projects.ownerId, ownerId));

  return {
    conceptCount: Number(stats?.conceptCount ?? 0),
    averageMastery: stats?.avgLevel != null ? Number(stats.avgLevel) : null,
  };
}

export async function getGlobalMaterialCount(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(materials)
    .innerJoin(projects, eq(materials.projectId, projects.id))
    .where(eq(projects.ownerId, ownerId));
  return Number(row?.count ?? 0);
}

export async function getGlobalQuizStats(projectIds: string[]) {
  if (projectIds.length === 0) return { totalQuizzes: 0, completedQuizzes: 0 };
  const [row] = await db
    .select({
      totalQuizzes: count(),
      completedQuizzes: sql<number>`count(*) filter (where ${quizzes.status} = 'completed')`,
    })
    .from(quizzes)
    .where(inArray(quizzes.projectId, projectIds));
  return { totalQuizzes: Number(row?.totalQuizzes ?? 0), completedQuizzes: Number(row?.completedQuizzes ?? 0) };
}
