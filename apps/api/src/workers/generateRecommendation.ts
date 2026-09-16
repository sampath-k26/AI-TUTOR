import type PgBoss from "pg-boss";
import { db } from "../core/db";
import { events } from "../../db/schema";
import { geminiProvider } from "../aiProvider";
import { getProjectById } from "../modules/learning/service";
import { getConceptsByIds } from "../modules/materials/service";
import * as repo from "../modules/assessment/repository";
import { detectRepeatedMistakeConcepts } from "../modules/assessment/mistakePattern";
import { recommendationGenerationSchema } from "../modules/assessment/schemas";
import { boss, ensureBossStarted, QUEUE_NAMES } from "./bossClient";

const WEAK_MASTERY_THRESHOLD = 50;

export interface GenerateRecommendationPayload {
  projectId: string;
}

export async function enqueueGenerateRecommendation(payload: GenerateRecommendationPayload): Promise<void> {
  const b = await ensureBossStarted();
  await b.send(QUEUE_NAMES.generateRecommendation, payload);
}

export async function registerGenerateRecommendationWorker(): Promise<void> {
  await ensureBossStarted();
  await boss.work<GenerateRecommendationPayload>(QUEUE_NAMES.generateRecommendation, async (jobs) => {
    for (const job of jobs) {
      await runGenerateRecommendationJob(job as PgBoss.Job<GenerateRecommendationPayload>);
    }
  });
}

/**
 * PRD §11's "Learning workflow" and "Repeated-mistake workflow": triggered by
 * quiz completion (assessment.finishQuiz), runs as a background job rather than
 * synchronously — the learner doesn't need this instantly, and it's a genuine
 * multi-step pipeline (evaluate accumulated evidence -> detect weakness ->
 * generate insight -> recommend next action), matching PRD principle 4
 * (asynchronous by design).
 */
async function runGenerateRecommendationJob(job: PgBoss.Job<GenerateRecommendationPayload>): Promise<void> {
  const { projectId } = job.data;

  const project = await getProjectById(projectId);
  if (!project) return; // project was deleted between enqueue and processing — nothing to do

  const [candidates, recentResponses, previousRecommendationTexts] = await Promise.all([
    repo.getConceptCandidates(projectId),
    repo.getRecentResponsesForProject(projectId),
    repo.getRecentRecommendationTexts(projectId),
  ]);

  const weakConceptIds = candidates.filter((c) => c.masteryLevel < WEAK_MASTERY_THRESHOLD).map((c) => c.conceptId);
  const repeatedMistakeConceptIds = detectRepeatedMistakeConcepts(recentResponses);

  if (weakConceptIds.length === 0 && repeatedMistakeConceptIds.length === 0) return; // nothing worth recommending yet

  const relevantConceptIds = [...new Set([...weakConceptIds, ...repeatedMistakeConceptIds])];
  const conceptNames = await getConceptsByIds(relevantConceptIds);
  const nameOf = (id: string) => conceptNames.get(id)?.name ?? "an unnamed concept";

  const generated = await geminiProvider.generateStructured({
    prompt: [
      `Project learning goal: ${project.learningGoal}`,
      `Weak concepts (mastery below ${WEAK_MASTERY_THRESHOLD}%): ${weakConceptIds.map(nameOf).join(", ") || "none"}`,
      `Concepts with repeated recent mistakes: ${repeatedMistakeConceptIds.map(nameOf).join(", ") || "none"}`,
      previousRecommendationTexts.length > 0
        ? `Previous recommendations already given (do not repeat these, suggest something new or more specific instead):\n${previousRecommendationTexts.map((t) => `- ${t}`).join("\n")}`
        : "No previous recommendations yet.",
      "Write one concrete, actionable recommendation for what the learner should do next.",
    ].join("\n"),
    schema: recommendationGenerationSchema,
    schemaName: "recommendation",
    feature: "recommendation",
    relatedEntity: { projectId },
  });

  await repo.createRecommendation({ projectId, text: generated.text, rationale: generated.rationale });
  await db.insert(events).values({
    userId: project.ownerId,
    projectId,
    type: "recommendation_generated",
    payload: { weakConceptIds, repeatedMistakeConceptIds },
  });
}
