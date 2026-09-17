import { and, count, desc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "../../core/db";
import { withCache } from "../../core/cache";
import {
  aiUsageLog,
  concepts,
  events,
  growthSnapshots,
  materials,
  mastery,
  projects,
  recommendations,
  questions,
  quizzes,
  responses,
} from "../../../db/schema";

/**
 * Direct multi-table reads are the documented exception for this module (see
 * docs/03-ARCHITECTURE.md's module table: "analytics ... reads from all
 * modules' tables (read-only)") — unlike every other module, which must go
 * through another module's service. Authorization is still enforced in
 * analytics/service.ts via learning.getProjectForOwner before any of these
 * run; the exception is about which tables may be queried, not about
 * skipping ownership checks.
 */

/** TTL for the dashboard-aggregate reads below (decision D18) — bounded staleness
 * accepted since every target here is a read-only aggregate the user re-visits,
 * not a live-updating view. */
const CACHE_TTL_MS = 30_000;

export async function getProjectEventCounts(projectId: string): Promise<Array<{ type: string; count: number }>> {
  return withCache(`analytics:eventCounts:${projectId}`, CACHE_TTL_MS, async () => {
    const rows = await db
      .select({ type: events.type, count: count() })
      .from(events)
      .where(eq(events.projectId, projectId))
      .groupBy(events.type);
    return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
  });
}

export async function getProjectAssessmentStats(projectId: string) {
  return withCache(`analytics:assessmentStats:${projectId}`, CACHE_TTL_MS, async () => {
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
  });
}

export async function getProjectMasterySummary(projectId: string) {
  return withCache(`analytics:masterySummary:${projectId}`, CACHE_TTL_MS, async () => {
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
  });
}

/** Day-bucketed mastery-over-time per concept (M10) — from data that already
 * exists (growth_snapshots), no new table. */
export async function getProjectMasteryHistory(projectId: string) {
  return withCache(`analytics:masteryHistory:${projectId}`, CACHE_TTL_MS, async () => {
    const rows = await db
      .select({
        conceptId: growthSnapshots.conceptId,
        conceptName: concepts.name,
        day: sql<string>`date_trunc('day', ${growthSnapshots.createdAt})`,
        avgLevel: sql<number>`avg(${growthSnapshots.level})`,
      })
      .from(growthSnapshots)
      .innerJoin(concepts, eq(growthSnapshots.conceptId, concepts.id))
      .where(eq(growthSnapshots.projectId, projectId))
      .groupBy(growthSnapshots.conceptId, concepts.name, sql`date_trunc('day', ${growthSnapshots.createdAt})`)
      .orderBy(sql`date_trunc('day', ${growthSnapshots.createdAt})`);

    return rows.map((r) => ({ conceptId: r.conceptId, conceptName: r.conceptName, date: r.day, level: Number(r.avgLevel) }));
  });
}

/** Day-bucketed AI call volume/cost for this project (M10) — from ai_usage_log,
 * no new table. */
export async function getProjectAiUsageHistory(projectId: string) {
  return withCache(`analytics:aiUsageHistory:${projectId}`, CACHE_TTL_MS, async () => {
    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${aiUsageLog.createdAt})`,
        callCount: count(),
        totalCostUsd: sql<number | null>`sum(${aiUsageLog.estimatedCostUsd})`,
      })
      .from(aiUsageLog)
      .where(sql`${aiUsageLog.relatedEntity} ->> 'projectId' = ${projectId}`)
      .groupBy(sql`date_trunc('day', ${aiUsageLog.createdAt})`)
      .orderBy(sql`date_trunc('day', ${aiUsageLog.createdAt})`);

    return rows.map((r) => ({ date: r.day, callCount: Number(r.callCount), totalCostUsd: r.totalCostUsd != null ? Number(r.totalCostUsd) : 0 }));
  });
}

export async function getProjectAiUsageSummary(projectId: string) {
  return withCache(`analytics:aiUsageSummary:${projectId}`, CACHE_TTL_MS, async () => {
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
  });
}

export async function getGlobalEventCounts(ownerId: string): Promise<Array<{ type: string; count: number }>> {
  return withCache(`analytics:globalEventCounts:${ownerId}`, CACHE_TTL_MS, async () => {
    const rows = await db
      .select({ type: events.type, count: count() })
      .from(events)
      .where(eq(events.userId, ownerId))
      .groupBy(events.type);
    return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
  });
}

export async function getGlobalMasterySummary(ownerId: string) {
  return withCache(`analytics:globalMasterySummary:${ownerId}`, CACHE_TTL_MS, async () => {
    const [stats] = await db
      .select({ conceptCount: count(), avgLevel: sql<number | null>`avg(${mastery.level})` })
      .from(mastery)
      .innerJoin(projects, eq(mastery.projectId, projects.id))
      .where(eq(projects.ownerId, ownerId));

    return {
      conceptCount: Number(stats?.conceptCount ?? 0),
      averageMastery: stats?.avgLevel != null ? Number(stats.avgLevel) : null,
    };
  });
}

export async function getGlobalMaterialCount(ownerId: string): Promise<number> {
  return withCache(`analytics:globalMaterialCount:${ownerId}`, CACHE_TTL_MS, async () => {
    const [row] = await db
      .select({ count: count() })
      .from(materials)
      .innerJoin(projects, eq(materials.projectId, projects.id))
      .where(eq(projects.ownerId, ownerId));
    return Number(row?.count ?? 0);
  });
}

export async function getRecentlyActiveProjectId(ownerId: string): Promise<string | null> {
  return withCache(`analytics:recentlyActiveProjectId:${ownerId}`, CACHE_TTL_MS, async () => {
    const [row] = await db
      .select({ projectId: events.projectId })
      .from(events)
      .where(and(eq(events.userId, ownerId), isNotNull(events.projectId)))
      .orderBy(desc(events.createdAt))
      .limit(1);
    return row?.projectId ?? null;
  });
}

/** Latest growth snapshot per concept, reduced in JS (same approach as getProjectMasterySummary above). */
export async function getConceptsRequiringAttention(ownerId: string, limitCount = 5) {
  return withCache(`analytics:conceptsRequiringAttention:${ownerId}:${limitCount}`, CACHE_TTL_MS, async () => {
    const rows = await db
      .select({
        conceptId: growthSnapshots.conceptId,
        conceptName: concepts.name,
        projectId: growthSnapshots.projectId,
        projectName: projects.name,
        trend: growthSnapshots.trend,
        level: growthSnapshots.level,
        createdAt: growthSnapshots.createdAt,
      })
      .from(growthSnapshots)
      .innerJoin(concepts, eq(growthSnapshots.conceptId, concepts.id))
      .innerJoin(projects, eq(growthSnapshots.projectId, projects.id))
      .where(eq(projects.ownerId, ownerId))
      .orderBy(desc(growthSnapshots.createdAt));

    const latestByConceptId = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByConceptId.has(row.conceptId)) latestByConceptId.set(row.conceptId, row);
    }

    return [...latestByConceptId.values()]
      .filter((r) => r.trend === "requires_attention")
      .slice(0, limitCount)
      .map((r) => ({
        conceptId: r.conceptId,
        conceptName: r.conceptName,
        projectId: r.projectId,
        projectName: r.projectName,
        level: Number(r.level),
      }));
  });
}

export async function getMostRecentActiveRecommendation(ownerId: string) {
  return withCache(`analytics:mostRecentActiveRecommendation:${ownerId}`, CACHE_TTL_MS, async () => {
    const [row] = await db
      .select({
        id: recommendations.id,
        text: recommendations.text,
        projectId: recommendations.projectId,
        projectName: projects.name,
        createdAt: recommendations.createdAt,
      })
      .from(recommendations)
      .innerJoin(projects, eq(recommendations.projectId, projects.id))
      .where(and(eq(projects.ownerId, ownerId), eq(recommendations.status, "active")))
      .orderBy(desc(recommendations.createdAt))
      .limit(1);
    return row ?? null;
  });
}

export async function getGlobalQuizStats(projectIds: string[]) {
  if (projectIds.length === 0) return { totalQuizzes: 0, completedQuizzes: 0 };
  const cacheKey = `analytics:globalQuizStats:${[...projectIds].sort().join(",")}`;
  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const [row] = await db
      .select({
        totalQuizzes: count(),
        completedQuizzes: sql<number>`count(*) filter (where ${quizzes.status} = 'completed')`,
      })
      .from(quizzes)
      .where(inArray(quizzes.projectId, projectIds));
    return { totalQuizzes: Number(row?.totalQuizzes ?? 0), completedQuizzes: Number(row?.completedQuizzes ?? 0) };
  });
}

/**
 * Sidebar's Activity log (User Home / global scope, not per-project): "spaces"
 * covers Space-lifecycle events, "projects" covers everything else (material
 * processing, Tutor messages, quizzes, mastery, recommendations — all of which
 * carry a project_id). A fixed, small set of types rather than a schema column,
 * since it's presentation-level grouping, not a distinct kind of event.
 */
const SPACE_EVENT_TYPES: string[] = ["space_created"];

function userActivityFilter(ownerId: string, category: "projects" | "spaces") {
  return and(eq(events.userId, ownerId), category === "spaces" ? inArray(events.type, SPACE_EVENT_TYPES) : notInArray(events.type, SPACE_EVENT_TYPES));
}

export async function getUserActivity(ownerId: string, category: "projects" | "spaces", limit: number, offset: number) {
  return db
    .select({
      id: events.id,
      type: events.type,
      projectId: events.projectId,
      projectName: projects.name,
      payload: events.payload,
      createdAt: events.createdAt,
    })
    .from(events)
    .leftJoin(projects, eq(events.projectId, projects.id))
    .where(userActivityFilter(ownerId, category))
    .orderBy(desc(events.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countUserActivity(ownerId: string, category: "projects" | "spaces"): Promise<number> {
  const [row] = await db.select({ count: count() }).from(events).where(userActivityFilter(ownerId, category));
  return Number(row?.count ?? 0);
}
