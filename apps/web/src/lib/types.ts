// Hand-mirrors apps/api response shapes (see docs/04-DATA-MODEL.md). The frontend and
// backend are independently deployable (decision D6), so types are duplicated here
// rather than shared via a workspace package — acceptable at this scope (decision D3).

export interface Profile {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface Space {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  theme: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  spaceId: string;
  ownerId: string;
  name: string;
  description: string;
  learningGoal: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  projectId: string;
  originalFilename: string;
  status: "queued" | "processing" | "ready" | "failed";
  pageCount: number | null;
  errorDetail: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Citation {
  materialId: string;
  materialName: string;
  page: number;
}

export interface TutorReply {
  conversationId: string;
  answer: string;
  citations: Citation[];
  insufficientEvidence: boolean;
}

/** Mirrors apps/api/src/modules/ai/schemas.ts's TutorStreamEvent (M9). */
export type TutorStreamEvent =
  | { type: "start"; conversationId: string }
  | { type: "token"; delta: string }
  | { type: "notice"; message: string }
  | { type: "done"; citations: Citation[]; insufficientEvidence: boolean; groundingUncertain: boolean }
  | { type: "error"; message: string };

export interface Quiz {
  id: string;
  projectId: string;
  status: "in_progress" | "completed";
}

export interface Question {
  id: string;
  type: "mcq" | "open_ended";
  difficulty: number;
  prompt: string;
  options?: string[];
}

export interface OpenEndedEvaluation {
  understanding: "strong" | "partial" | "weak";
  accuracy: number;
  keyConceptsCovered: string[];
  missingConcepts: string[];
  feedbackText: string;
}

export interface McqEvaluation {
  correctIndex: number;
  submittedIndex: number;
  isCorrect: boolean;
}

export interface AnswerResult {
  response: { id: string };
  evaluation: OpenEndedEvaluation | McqEvaluation;
  masteryLevel: number;
  trend: "improving" | "stable" | "requires_attention";
}

export interface GrowthItem {
  conceptId: string;
  conceptName: string;
  level: number;
  trend: "improving" | "stable" | "requires_attention";
  updatedAt: string;
}

export interface Recommendation {
  id: string;
  projectId: string;
  text: string;
  rationale: Record<string, unknown> | null;
  status: "active" | "dismissed" | "completed";
  createdAt: string;
}

export interface EventCount {
  type: string;
  count: number;
}

export interface ProjectAnalytics {
  eventCounts: EventCount[];
  assessmentStats: {
    totalQuizzes: number;
    completedQuizzes: number;
    totalQuestionsAnswered: number;
    correctCount: number;
    averageScore: number | null;
  };
  masterySummary: {
    conceptCount: number;
    averageMastery: number | null;
    trendCounts: { improving: number; stable: number; requires_attention: number };
  };
  aiUsage: {
    callCount: number;
    successCount: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCostUsd: number;
    averageLatencyMs: number | null;
  };
}

export interface MasteryHistoryPoint {
  conceptId: string;
  conceptName: string;
  date: string;
  level: number;
}

export interface AiUsageHistoryPoint {
  date: string;
  callCount: number;
  totalCostUsd: number;
}

export interface EngagementHistoryPoint {
  date: string;
  activeUsers: number;
}

export interface GlobalAnalytics {
  projectCount: number;
  materialCount: number;
  eventCounts: EventCount[];
  masterySummary: { conceptCount: number; averageMastery: number | null };
  quizStats: { totalQuizzes: number; completedQuizzes: number };
}

export interface AttentionConcept {
  conceptId: string;
  conceptName: string;
  projectId: string;
  projectName: string;
  level: number;
}

export interface RecommendedNextAction {
  id: string;
  text: string;
  projectId: string;
  projectName: string;
  createdAt: string;
}

export interface HomeOverview {
  recentProjects: Project[];
  continueLearningProject: Project | null;
  overallProgress: { conceptCount: number; averageMastery: number | null };
  areasRequiringAttention: AttentionConcept[];
  recommendedNextAction: RecommendedNextAction | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface AdminSpace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
}

export interface AdminProject {
  id: string;
  name: string;
  status: "active" | "archived";
  spaceId: string;
  spaceName: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
}

export interface AdminActivityEvent {
  id: string;
  type: string;
  userId: string;
  userEmail: string;
  projectId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminEngagement {
  totalUsers: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
  activeUsersLast30d: number;
  totalSpaces: number;
  totalProjects: number;
}

export interface AdminLearningAnalytics {
  conceptCount: number;
  averageMastery: number | null;
  totalQuizzes: number;
  completedQuizzes: number;
  totalMaterials: number;
}

export interface AdminAiUsage {
  callCount: number;
  successCount: number;
  totalCostUsd: number;
  averageLatencyMs: number | null;
  byProvider: Array<{ provider: string; feature: string; callCount: number; successCount: number }>;
  recentErrors: Array<{ id: string; provider: string; feature: string; errorDetail: string | null; createdAt: string }>;
}

export interface AdminAiEvaluation {
  lastRunAt: string | null;
  bySuite: Array<{ suite: string; verdict: string; count: number; averageScore: number | null }>;
}

export interface AdminBackgroundJobs {
  queueCounts: Array<{ queue: string; state: string; count: number }>;
  recentFailedJobs: Array<{ id: string; queue: string; output: unknown; completedOn: string | null }>;
}

export interface AdminSystemHealth {
  database: "ok";
  worker: { lastProcessedAt: string | null; status: "ok" | "stale" };
  aiProviders: { callsLastHour: number; successRateLastHour: number | null; status: "ok" | "degraded" };
}

export interface ProjectSearchResult {
  projects: Project[];
  total: number;
  limit: number;
  offset: number;
}

export type ActivityCategory = "projects" | "spaces";

export interface ActivityItem {
  id: string;
  type: string;
  projectId: string | null;
  projectName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityResult {
  activity: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
}
