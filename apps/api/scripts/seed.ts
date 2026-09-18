/**
 * Demo data seed script (docs/02-DECISIONS-LOG.md "Seed Data Strategy"): calls the
 * exact same service-layer functions the real application uses (createSpace,
 * uploadMaterial, handleTutorMessage, startQuiz, submitAnswer, finishQuiz, ...)
 * rather than inserting fixture rows directly, so seeded data is always
 * internally consistent and this script doubles as an end-to-end smoke test —
 * if the real pipeline breaks, seeding fails loudly instead of producing stale
 * demo data.
 *
 * Idempotent: re-running skips any demo user whose profile already exists
 * rather than duplicating them.
 *
 * Usage: npm run seed --workspace apps/api (requires GEMINI_API_KEY/GROQ_API_KEY
 * and a working Supabase connection in apps/api/.env).
 */
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { config, isAiConfigured } from "../src/core/config";
import { supabaseClientOptions } from "../src/core/supabaseClientOptions";
import { db, pool } from "../src/core/db";
import { profiles } from "../db/schema";
import * as learningService from "../src/modules/learning/service";
import * as materialsService from "../src/modules/materials/service";
import * as assessmentService from "../src/modules/assessment/service";
import * as aiService from "../src/modules/ai/service";
import { boss } from "../src/workers/bossClient";
import { registerProcessMaterialWorker } from "../src/workers/processMaterial";
import { registerGenerateRecommendationWorker } from "../src/workers/generateRecommendation";
import { buildDemoPdf, buildFakeUploadFile, getOrCreateUser, sleep, waitForMaterialReady } from "./_shared/fixtures";

const DEMO_PASSWORD = "DemoLearner123!";

interface DemoMaterial {
  filename: string;
  title: string;
  paragraphs: string[];
}

interface DemoUserSpec {
  email: string;
  role: "user" | "admin";
  space?: { name: string; description: string };
  project?: { name: string; description: string; learningGoal: string };
  material?: DemoMaterial;
  tutorQuestion?: string;
  offTopicQuestion?: string;
}

const DEMO_USERS: DemoUserSpec[] = [
  {
    email: "demo.admin@aitutor.local",
    role: "admin",
  },
  {
    email: "demo.learner1@aitutor.local",
    role: "user",
    space: { name: "Machine Learning Basics", description: "Foundational ML concepts, one topic at a time." },
    project: {
      name: "Optimization Algorithms",
      description: "Understanding how models learn from data.",
      learningGoal: "Explain how gradient descent optimizes a loss function.",
    },
    material: {
      filename: "gradient-descent.pdf",
      title: "Gradient Descent Notes",
      paragraphs: [
        "Gradient descent is an iterative optimization algorithm used to minimize a loss function by repeatedly moving in the direction of steepest descent, defined as the negative of the gradient.",
        "At each step, the parameters are updated by subtracting the learning rate multiplied by the gradient. A learning rate that is too large can cause the algorithm to diverge, while one that is too small leads to slow convergence.",
        "Stochastic gradient descent computes the gradient using a single randomly selected training example at each step, which introduces noise but greatly reduces computation compared to batch gradient descent, which uses the entire training set.",
      ],
    },
    tutorQuestion: "What is gradient descent and how does the learning rate affect it?",
    offTopicQuestion: "What is the capital of France?",
  },
  {
    email: "demo.learner2@aitutor.local",
    role: "user",
    space: { name: "Biology Fundamentals", description: "Core concepts in plant biology." },
    project: {
      name: "Plant Energy Systems",
      description: "How plants convert light into usable energy.",
      learningGoal: "Explain the stages of photosynthesis.",
    },
    material: {
      filename: "photosynthesis.pdf",
      title: "Photosynthesis Basics",
      paragraphs: [
        "Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose.",
        "The light-dependent reactions occur in the thylakoid membrane and use sunlight to split water molecules, releasing oxygen and generating ATP and NADPH.",
        "The light-independent reactions, also called the Calvin cycle, take place in the stroma and use the ATP and NADPH from the light-dependent reactions to fix carbon dioxide into glucose.",
      ],
    },
    tutorQuestion: "What happens during the light-dependent reactions of photosynthesis?",
    offTopicQuestion: "Who wrote Romeo and Juliet?",
  },
  {
    email: "demo.learner3@aitutor.local",
    role: "user",
    space: { name: "Chemistry Essentials", description: "Core concepts in general chemistry." },
    project: {
      name: "Chemical Bonding",
      description: "Why atoms bond the way they do.",
      learningGoal: "Explain the difference between ionic and covalent bonds.",
    },
    material: {
      filename: "chemical-bonding.pdf",
      title: "Chemical Bonding Notes",
      paragraphs: [
        "An ionic bond forms when one atom transfers one or more electrons to another atom, creating oppositely charged ions that attract each other electrostatically — typically between a metal and a nonmetal, such as sodium and chlorine forming sodium chloride.",
        "A covalent bond forms when two atoms share one or more pairs of electrons rather than transferring them outright, most commonly between two nonmetals; the shared electrons let each atom achieve a more stable, filled outer electron shell.",
        "Electronegativity, an atom's tendency to attract shared electrons toward itself, determines which bond type forms and how polar a covalent bond is: a large electronegativity difference favors an ionic bond, a small or zero difference favors a nonpolar covalent bond, and an intermediate difference produces a polar covalent bond.",
      ],
    },
    tutorQuestion: "What determines whether two atoms form an ionic bond or a covalent bond?",
    offTopicQuestion: "What year did the Berlin Wall fall?",
  },
];

const QUIZ_QUESTION_COUNT = 3;
const RECOMMENDATION_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 2_000;
const INTER_LEARNER_PAUSE_MS = 15_000;

async function findExistingProfileByEmail(email: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  return row;
}

async function waitForRecommendation(projectId: string, ownerId: string): Promise<boolean> {
  const deadline = Date.now() + RECOMMENDATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const recommendations = await assessmentService.getRecommendations(projectId, ownerId);
    if (recommendations && recommendations.length > 0) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function seedLearnerProject(spec: DemoUserSpec, ownerId: string): Promise<void> {
  if (!spec.space || !spec.project || !spec.material) return;

  const space = await learningService.createSpace(ownerId, { name: spec.space.name, description: spec.space.description });
  if (!space) throw new Error("Failed to create demo space");
  console.log(`  Space created: ${space.name}`);

  const project = await learningService.createProject(space.id, ownerId, spec.project);
  if (!project) throw new Error("Failed to create demo project");
  console.log(`  Project created: ${project.name}`);

  const fileBuffer = buildDemoPdf(spec.material.title, spec.material.paragraphs);
  const material = await materialsService.uploadMaterial(project.id, ownerId, buildFakeUploadFile(spec.material.filename, fileBuffer));
  if (!material) throw new Error("Failed to upload demo material");
  console.log(`  Material uploaded, waiting for processing...`);
  await waitForMaterialReady(material.id, ownerId);
  console.log(`  Material ready.`);

  if (spec.tutorQuestion) {
    const groundedReply = await aiService.handleTutorMessage(project.id, ownerId, spec.tutorQuestion, undefined);
    console.log(`  Tutor answered grounded question (citations: ${groundedReply?.citations.length ?? 0}).`);

    if (spec.offTopicQuestion) {
      const offTopicReply = await aiService.handleTutorMessage(project.id, ownerId, spec.offTopicQuestion, groundedReply?.conversationId);
      console.log(`  Tutor handled off-topic question (insufficientEvidence: ${offTopicReply?.insufficientEvidence}).`);
    }
  }

  const quiz = await assessmentService.startQuiz(project.id, ownerId);
  if (!quiz) throw new Error("Failed to start demo quiz");

  for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
    const next = await assessmentService.generateNextQuestion(quiz.id, project.id, ownerId);
    if (!next || "noConceptsAvailable" in next) break;

    const { question } = next;
    if (!question) break;
    const answer = question.type === "mcq" ? "0" : "It has something to do with the material, but I'm not entirely sure of the details.";
    const result = await assessmentService.submitAnswer(question.id!, project.id, ownerId, answer);
    console.log(`  Answered question ${i + 1} (${question.type}) — mastery now ${result?.masteryLevel.toFixed(0)}%.`);
  }

  await assessmentService.finishQuiz(quiz.id, project.id, ownerId);
  console.log(`  Quiz finished, waiting for recommendation generation...`);
  const gotRecommendation = await waitForRecommendation(project.id, ownerId);
  console.log(gotRecommendation ? "  Recommendation generated." : "  No recommendation generated (mastery may already be high enough).");
}

async function main() {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY must be set to seed demo data.");
  }
  if (!isAiConfigured.gemini || !isAiConfigured.groq) {
    throw new Error("GEMINI_API_KEY/GROQ_API_KEY must be set to seed demo data (the pipeline makes real AI calls).");
  }

  const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, supabaseClientOptions);

  // Runs its own in-process workers so `npm run seed` works standalone, without
  // requiring `npm run worker` to already be running in another terminal.
  await registerProcessMaterialWorker();
  await registerGenerateRecommendationWorker();

  for (const spec of DEMO_USERS) {
    console.log(`\n=== ${spec.email} ===`);
    const existing = await findExistingProfileByEmail(spec.email);
    if (existing) {
      console.log("  Already seeded — skipping.");
      continue;
    }

    const userId = await getOrCreateUser(supabaseAdmin, spec.email, DEMO_PASSWORD);
    await learningService.ensureProfile(userId, spec.email);
    if (spec.role === "admin") {
      await db.update(profiles).set({ role: "admin" }).where(eq(profiles.id, userId));
      console.log("  Profile created and promoted to admin.");
      continue;
    }

    await seedLearnerProject(spec, userId);
    // Gemini's free tier caps at 5 requests/minute/model (hit live while seeding
    // two learners back-to-back — see aiProvider/base.ts's withRetry). Pausing
    // between learners keeps a normal seed run from leaning on those retries at all.
    await sleep(INTER_LEARNER_PAUSE_MS);
  }

  console.log("\nSeed complete.");
  await boss.stop({ close: true });
  await pool.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
