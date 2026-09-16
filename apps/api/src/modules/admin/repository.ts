import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../core/db";
import {
  aiUsageLog,
  evalResult,
  events,
  materials,
  mastery,
  profiles,
  projects,
  quizzes,
  spaces,
} from "../../../db/schema";

/**
 * Direct multi-table, cross-user reads are the documented admin-module exception
 * (see CLAUDE.md/03-ARCHITECTURE.md's module table) — every query here is
 * platform-wide by design. Authorization is enforced once, up front, by the
 * requireAdmin middleware (core/auth.ts), not per-row here.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampLimit(limit?: number): number {
  if (!limit) return DEFAULT_LIMIT;
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

export async function listUsers(limit?: number, offset = 0) {
  return db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role, createdAt: profiles.createdAt })
    .from(profiles)
    .orderBy(desc(profiles.createdAt))
    .limit(clampLimit(limit))
    .offset(offset);
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(profiles);
  return Number(row?.count ?? 0);
}

export async function listAllSpaces(limit?: number, offset = 0) {
  return db
    .select({
      id: spaces.id,
      name: spaces.name,
      description: spaces.description,
      ownerId: spaces.ownerId,
      ownerEmail: profiles.email,
      createdAt: spaces.createdAt,
    })
    .from(spaces)
    .innerJoin(profiles, eq(spaces.ownerId, profiles.id))
    .orderBy(desc(spaces.createdAt))
    .limit(clampLimit(limit))
    .offset(offset);
}

export async function listAllProjectsAdmin(limit?: number, offset = 0) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      spaceId: projects.spaceId,
      spaceName: spaces.name,
      ownerId: projects.ownerId,
      ownerEmail: profiles.email,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(spaces, eq(projects.spaceId, spaces.id))
    .innerJoin(profiles, eq(projects.ownerId, profiles.id))
    .orderBy(desc(projects.createdAt))
    .limit(clampLimit(limit))
    .offset(offset);
}

export interface ActivityFilter {
  type?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

export async function listActivity(filter: ActivityFilter, limit?: number, offset = 0) {
  const conditions = [
    filter.type ? eq(events.type, filter.type) : undefined,
    filter.userId ? eq(events.userId, filter.userId) : undefined,
    filter.from ? gte(events.createdAt, filter.from) : undefined,
    filter.to ? lte(events.createdAt, filter.to) : undefined,
  ].filter((c) => c !== undefined);

  return db
    .select({
      id: events.id,
      type: events.type,
      userId: events.userId,
      userEmail: profiles.email,
      projectId: events.projectId,
      payload: events.payload,
      createdAt: events.createdAt,
    })
    .from(events)
    .innerJoin(profiles, eq(events.userId, profiles.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(events.createdAt))
    .limit(clampLimit(limit))
    .offset(offset);
}

export async function getEngagementStats() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [[totalUsersRow], [activeDayRow], [activeWeekRow], [activeMonthRow], [totalSpacesRow], [totalProjectsRow]] =
    await Promise.all([
      db.select({ count: count() }).from(profiles),
      db.select({ count: sql<number>`count(distinct ${events.userId})` }).from(events).where(gte(events.createdAt, dayAgo)),
      db.select({ count: sql<number>`count(distinct ${events.userId})` }).from(events).where(gte(events.createdAt, weekAgo)),
      db.select({ count: sql<number>`count(distinct ${events.userId})` }).from(events).where(gte(events.createdAt, monthAgo)),
      db.select({ count: count() }).from(spaces),
      db.select({ count: count() }).from(projects),
    ]);

  return {
    totalUsers: Number(totalUsersRow?.count ?? 0),
    activeUsersLast24h: Number(activeDayRow?.count ?? 0),
    activeUsersLast7d: Number(activeWeekRow?.count ?? 0),
    activeUsersLast30d: Number(activeMonthRow?.count ?? 0),
    totalSpaces: Number(totalSpacesRow?.count ?? 0),
    totalProjects: Number(totalProjectsRow?.count ?? 0),
  };
}

export async function getPlatformLearningAnalytics() {
  const [[masteryStats], [quizStats], [materialStats]] = await Promise.all([
    db.select({ conceptCount: count(), avgLevel: sql<number | null>`avg(${mastery.level})` }).from(mastery),
    db
      .select({
        totalQuizzes: count(),
        completedQuizzes: sql<number>`count(*) filter (where ${quizzes.status} = 'completed')`,
      })
      .from(quizzes),
    db.select({ count: count() }).from(materials),
  ]);

  return {
    conceptCount: Number(masteryStats?.conceptCount ?? 0),
    averageMastery: masteryStats?.avgLevel != null ? Number(masteryStats.avgLevel) : null,
    totalQuizzes: Number(quizStats?.totalQuizzes ?? 0),
    completedQuizzes: Number(quizStats?.completedQuizzes ?? 0),
    totalMaterials: Number(materialStats?.count ?? 0),
  };
}

export async function getPlatformAiUsage() {
  const [overall] = await db
    .select({
      callCount: count(),
      successCount: sql<number>`count(*) filter (where ${aiUsageLog.success} = true)`,
      totalCostUsd: sql<number | null>`sum(${aiUsageLog.estimatedCostUsd})`,
      averageLatencyMs: sql<number | null>`avg(${aiUsageLog.latencyMs})`,
    })
    .from(aiUsageLog);

  const byProvider = await db
    .select({
      provider: aiUsageLog.provider,
      feature: aiUsageLog.feature,
      callCount: count(),
      successCount: sql<number>`count(*) filter (where ${aiUsageLog.success} = true)`,
    })
    .from(aiUsageLog)
    .groupBy(aiUsageLog.provider, aiUsageLog.feature);

  const recentErrors = await db
    .select({
      id: aiUsageLog.id,
      provider: aiUsageLog.provider,
      feature: aiUsageLog.feature,
      errorDetail: aiUsageLog.errorDetail,
      createdAt: aiUsageLog.createdAt,
    })
    .from(aiUsageLog)
    .where(eq(aiUsageLog.success, false))
    .orderBy(desc(aiUsageLog.createdAt))
    .limit(10);

  return {
    callCount: Number(overall?.callCount ?? 0),
    successCount: Number(overall?.successCount ?? 0),
    totalCostUsd: overall?.totalCostUsd != null ? Number(overall.totalCostUsd) : 0,
    averageLatencyMs: overall?.averageLatencyMs != null ? Number(overall.averageLatencyMs) : null,
    byProvider: byProvider.map((r) => ({
      provider: r.provider,
      feature: r.feature,
      callCount: Number(r.callCount),
      successCount: Number(r.successCount),
    })),
    recentErrors,
  };
}

export async function getAiEvaluationSummary() {
  const rows = await db
    .select({
      suite: evalResult.suite,
      verdict: evalResult.verdict,
      count: count(),
      avgScore: sql<number | null>`avg(${evalResult.score})`,
    })
    .from(evalResult)
    .groupBy(evalResult.suite, evalResult.verdict);

  const latestRun = await db.select({ createdAt: evalResult.createdAt }).from(evalResult).orderBy(desc(evalResult.createdAt)).limit(1);

  return {
    lastRunAt: latestRun[0]?.createdAt ?? null,
    bySuite: rows.map((r) => ({
      suite: r.suite,
      verdict: r.verdict,
      count: Number(r.count),
      averageScore: r.avgScore != null ? Number(r.avgScore) : null,
    })),
  };
}

interface BackgroundJobStatusRow extends Record<string, unknown> {
  name: string;
  state: string;
  job_count: string;
}

export async function getBackgroundJobStatus() {
  const { rows } = await db.execute<BackgroundJobStatusRow>(
    sql`select name, state, count(*) as job_count from pgboss.job group by name, state order by name, state`,
  );

  const { rows: recentFailedRows } = await db.execute<{
    id: string;
    name: string;
    output: unknown;
    completed_on: string | null;
  }>(
    sql`select id, name, output, completed_on from pgboss.job where state = 'failed' order by completed_on desc nulls last limit 10`,
  );

  return {
    queueCounts: rows.map((r) => ({ queue: r.name, state: r.state, count: Number(r.job_count) })),
    recentFailedJobs: recentFailedRows.map((r) => ({
      id: r.id,
      queue: r.name,
      output: r.output,
      completedOn: r.completed_on,
    })),
  };
}

export async function getLastProcessedJobAt(): Promise<Date | null> {
  const { rows } = await db.execute<{ completed_on: string | null }>(
    sql`select max(completed_on) as completed_on from pgboss.job where state = 'completed'`,
  );
  const value = rows[0]?.completed_on;
  return value ? new Date(value) : null;
}

export async function getRecentAiSuccessRate(sinceMinutes = 60): Promise<{ callCount: number; successRate: number | null }> {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
  const [row] = await db
    .select({
      callCount: count(),
      successCount: sql<number>`count(*) filter (where ${aiUsageLog.success} = true)`,
    })
    .from(aiUsageLog)
    .where(gte(aiUsageLog.createdAt, since));

  const callCount = Number(row?.callCount ?? 0);
  const successCount = Number(row?.successCount ?? 0);
  return { callCount, successRate: callCount > 0 ? successCount / callCount : null };
}
