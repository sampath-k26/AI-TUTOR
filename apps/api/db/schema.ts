import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Mirrors docs/04-DATA-MODEL.md. Embedding dimensionality (768) matches the
 * Gemini embedding output configured in aiProvider/geminiProvider.ts — if that
 * ever changes, this column (and any existing embeddings) must be migrated together.
 */
export const EMBEDDING_DIMENSIONS = 768;

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const materialStatusEnum = pgEnum("material_status", ["queued", "processing", "ready", "failed"]);
export const projectStatusEnum = pgEnum("project_status", ["active", "archived"]);
export const questionTypeEnum = pgEnum("question_type", ["mcq", "open_ended"]);
export const quizStatusEnum = pgEnum("quiz_status", ["in_progress", "completed"]);
export const recommendationStatusEnum = pgEnum("recommendation_status", ["active", "dismissed", "completed"]);
export const learningContextTypeEnum = pgEnum("learning_context_type", [
  "goal",
  "preference",
  "strength",
  "weakness",
  "mistake",
  "tutor_note",
]);
export const growthTrendEnum = pgEnum("growth_trend", ["improving", "stable", "requires_attention"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);
export const aiFeatureEnum = pgEnum("ai_feature", [
  "tutor",
  "quiz_generation",
  "grading",
  "recommendation",
  "document_understanding",
  "embedding",
  "eval",
  "learning_plan",
]);
export const learningPlanStatusEnum = pgEnum("learning_plan_status", ["active", "archived"]);
export const learningPlanStepTypeEnum = pgEnum("learning_plan_step_type", ["material", "tutor", "quiz", "other"]);

// Extends Supabase's auth.users — id must equal auth.users.id (see db/migrations for the FK note).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    theme: jsonb("theme"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("spaces_owner_id_idx").on(table.ownerId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    learningGoal: text("learning_goal").notNull(),
    status: projectStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("projects_owner_id_idx").on(table.ownerId),
    index("projects_space_id_idx").on(table.spaceId),
  ],
);

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    originalFilename: text("original_filename").notNull(),
    status: materialStatusEnum("status").notNull().default("queued"),
    pageCount: integer("page_count"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [index("materials_project_id_idx").on(table.projectId)],
);

export const materialChunks = pgTable(
  "material_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("material_chunks_project_id_idx").on(table.projectId),
    index("material_chunks_material_id_idx").on(table.materialId),
    index("material_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ],
);

export const concepts = pgTable(
  "concepts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    sourceMaterialIds: uuid("source_material_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("concepts_project_id_idx").on(table.projectId)],
);

export const mastery = pgTable(
  "mastery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    level: numeric("level", { precision: 5, scale: 2 }).notNull().default("0"),
    confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull().default("0"),
    evidenceCount: integer("evidence_count").notNull().default(0),
    lastEvidenceAt: timestamp("last_evidence_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("mastery_project_concept_uq").on(table.projectId, table.conceptId)],
);

export const growthSnapshots = pgTable(
  "growth_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    level: numeric("level", { precision: 5, scale: 2 }).notNull(),
    trend: growthTrendEnum("trend").notNull(),
    evidenceRef: jsonb("evidence_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("growth_snapshots_project_concept_idx").on(table.projectId, table.conceptId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("conversations_project_id_idx").on(table.projectId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    /** [{ materialId: string; page: number }] — validated against Zod schema before persisting */
    citations: jsonb("citations"),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    model: text("model"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_conversation_id_idx").on(table.conversationId)],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: quizStatusEnum("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("quizzes_project_id_idx").on(table.projectId)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    type: questionTypeEnum("type").notNull(),
    difficulty: integer("difficulty").notNull(),
    prompt: text("prompt").notNull(),
    /** mcq only: string[] of options */
    options: jsonb("options"),
    answerKey: jsonb("answer_key").notNull(),
    generatedBy: text("generated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("questions_quiz_id_idx").on(table.quizId)],
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userAnswer: text("user_answer").notNull(),
    isCorrect: boolean("is_correct"),
    /** { understanding, accuracy, keyConceptsCovered, missingConcepts, feedbackText } */
    evaluation: jsonb("evaluation"),
    score: numeric("score", { precision: 3, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("responses_question_id_idx").on(table.questionId)],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    rationale: jsonb("rationale"),
    status: recommendationStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recommendations_project_id_idx").on(table.projectId)],
);

export const learningContext = pgTable(
  "learning_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: learningContextTypeEnum("type").notNull(),
    content: text("content").notNull(),
    relevanceScore: numeric("relevance_score", { precision: 4, scale: 3 }).notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastReinforcedAt: timestamp("last_reinforced_at", { withTimezone: true }),
  },
  (table) => [index("learning_context_project_id_idx").on(table.projectId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload"),
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("events_user_id_idx").on(table.userId),
    index("events_project_id_idx").on(table.projectId),
    uniqueIndex("events_dedupe_key_uq").on(table.dedupeKey),
  ],
);

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feature: aiFeatureEnum("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6 }),
    success: boolean("success").notNull(),
    errorDetail: text("error_detail"),
    relatedEntity: jsonb("related_entity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_usage_log_feature_idx").on(table.feature),
    index("ai_usage_log_created_at_idx").on(table.createdAt),
  ],
);

export const learningPlans = pgTable(
  "learning_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: learningPlanStatusEnum("status").notNull().default("active"),
    rationale: jsonb("rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("learning_plans_project_id_idx").on(table.projectId)],
);

export const learningPlanSteps = pgTable(
  "learning_plan_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => learningPlans.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    type: learningPlanStepTypeEnum("type").notNull(),
    description: text("description").notNull(),
    // set null (not cascade): a step outliving its linked material/concept should
    // stay on the plan as a step, not disappear because the source was deleted/reprocessed.
    relatedMaterialId: uuid("related_material_id").references(() => materials.id, { onDelete: "set null" }),
    relatedConceptId: uuid("related_concept_id").references(() => concepts.id, { onDelete: "set null" }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("learning_plan_steps_plan_id_idx").on(table.planId)],
);

export const evalResult = pgTable(
  "eval_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    suite: text("suite").notNull(),
    caseId: text("case_id").notNull(),
    verdict: text("verdict").notNull(),
    score: numeric("score", { precision: 4, scale: 3 }),
    notes: text("notes"),
    modelSnapshot: text("model_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("eval_result_suite_idx").on(table.suite)],
);
