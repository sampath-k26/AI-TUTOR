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

export interface GlobalAnalytics {
  projectCount: number;
  materialCount: number;
  eventCounts: EventCount[];
  masterySummary: { conceptCount: number; averageMastery: number | null };
  quizStats: { totalQuizzes: number; completedQuizzes: number };
}
