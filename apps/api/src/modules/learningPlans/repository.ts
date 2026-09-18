import { and, asc, eq } from "drizzle-orm";
import { db, type Executor } from "../../core/db";
import { learningPlans, learningPlanSteps } from "../../../db/schema";

export interface NewPlanStep {
  type: "material" | "tutor" | "quiz" | "other";
  description: string;
  relatedMaterialId: string | null;
  relatedConceptId: string | null;
}

async function getStepsForPlan(planId: string, executor: Executor = db) {
  return executor.select().from(learningPlanSteps).where(eq(learningPlanSteps.planId, planId)).orderBy(asc(learningPlanSteps.orderIndex));
}

export async function getActivePlanForProject(projectId: string) {
  const [plan] = await db
    .select()
    .from(learningPlans)
    .where(and(eq(learningPlans.projectId, projectId), eq(learningPlans.status, "active")))
    .limit(1);
  if (!plan) return undefined;
  return { plan, steps: await getStepsForPlan(plan.id) };
}

export async function archiveActivePlans(projectId: string, executor: Executor = db) {
  await executor
    .update(learningPlans)
    .set({ status: "archived" })
    .where(and(eq(learningPlans.projectId, projectId), eq(learningPlans.status, "active")));
}

/** Archiving the old plan and inserting the new one must happen atomically —
 * callers that need both together (generatePlan) should run this inside
 * `db.transaction()` and pass the tx as `executor`, so a failure between the
 * two steps can't leave a project with no active plan at all. */
export async function createPlan(projectId: string, rationale: unknown, steps: NewPlanStep[], executor: Executor = db) {
  const [plan] = await executor.insert(learningPlans).values({ projectId, rationale }).returning();
  if (!plan) throw new Error("Learning plan insert returned no row");

  if (steps.length > 0) {
    await executor.insert(learningPlanSteps).values(
      steps.map((step, i) => ({
        planId: plan.id,
        orderIndex: i,
        type: step.type,
        description: step.description,
        relatedMaterialId: step.relatedMaterialId,
        relatedConceptId: step.relatedConceptId,
      })),
    );
  }

  return { plan, steps: await getStepsForPlan(plan.id, executor) };
}

/** Scoped by projectId via a join to learning_plans (defense layer 1 of decision D16). */
export async function getStepWithPlanForOwner(stepId: string, projectId: string) {
  const [row] = await db
    .select({ step: learningPlanSteps, plan: learningPlans })
    .from(learningPlanSteps)
    .innerJoin(learningPlans, eq(learningPlanSteps.planId, learningPlans.id))
    .where(and(eq(learningPlanSteps.id, stepId), eq(learningPlans.projectId, projectId)))
    .limit(1);
  return row;
}

export async function setStepCompleted(stepId: string, completed: boolean) {
  const [step] = await db
    .update(learningPlanSteps)
    .set({ completed, completedAt: completed ? new Date() : null })
    .where(eq(learningPlanSteps.id, stepId))
    .returning();
  return step;
}
