import { createAuthUser } from "../../core/supabaseAdmin";
import * as repo from "./repository";
import type { ActivityFilter } from "./repository";

export async function getUsers(limit?: number, offset?: number) {
  const [users, total] = await Promise.all([repo.listUsers(limit, offset ?? 0), repo.countUsers()]);
  return { users, total };
}

export async function createUser(email: string, password: string, role: "user" | "admin") {
  const authUser = await createAuthUser(email, password);
  return repo.createUserProfile(authUser.id, email, role);
}

export async function getSpaces(limit?: number, offset?: number) {
  return repo.listAllSpaces(limit, offset ?? 0);
}

export async function getProjects(limit?: number, offset?: number) {
  return repo.listAllProjectsAdmin(limit, offset ?? 0);
}

export async function getActivity(filter: ActivityFilter, limit?: number, offset?: number) {
  return repo.listActivity(filter, limit, offset ?? 0);
}

export async function getEngagement() {
  return repo.getEngagementStats();
}

export async function getEngagementHistory(days?: number) {
  return repo.getEngagementHistory(days);
}

export async function getPlatformAiUsageHistory(days?: number) {
  return repo.getPlatformAiUsageHistory(days);
}

export async function getLearningAnalytics() {
  return repo.getPlatformLearningAnalytics();
}

export async function getAiUsage() {
  return repo.getPlatformAiUsage();
}

export async function getAiEvaluation() {
  return repo.getAiEvaluationSummary();
}

export async function getBackgroundJobs() {
  return repo.getBackgroundJobStatus();
}

const STALE_WORKER_THRESHOLD_MINUTES = 30;

/**
 * Prototype-scale health check (PRD's "system health" ask), not a full observability
 * stack: DB reachability is implicit (this handler only runs if the query below
 * succeeds), worker liveness is inferred from how recently a job last completed, and
 * AI health is the last hour's success rate rather than a synthetic uptime probe.
 */
export async function getSystemHealth() {
  const [lastProcessedAt, aiHealth] = await Promise.all([repo.getLastProcessedJobAt(), repo.getRecentAiSuccessRate(60)]);

  const minutesSinceLastJob = lastProcessedAt ? (Date.now() - lastProcessedAt.getTime()) / 60_000 : null;

  return {
    database: "ok" as const,
    worker: {
      lastProcessedAt,
      status: minutesSinceLastJob === null || minutesSinceLastJob <= STALE_WORKER_THRESHOLD_MINUTES ? "ok" : "stale",
    },
    aiProviders: {
      callsLastHour: aiHealth.callCount,
      successRateLastHour: aiHealth.successRate,
      status: aiHealth.successRate === null || aiHealth.successRate >= 0.5 ? "ok" : "degraded",
    },
  };
}
