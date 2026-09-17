import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  getActivePlanForProject: vi.fn(),
  archiveActivePlans: vi.fn(),
  createPlan: vi.fn(),
  getStepWithPlanForOwner: vi.fn(),
  setStepCompleted: vi.fn(),
}));

const learningServiceMocks = vi.hoisted(() => ({
  getProjectForOwner: vi.fn(),
}));

const assessmentServiceMocks = vi.hoisted(() => ({
  getGrowthOverview: vi.fn(),
}));

const materialsServiceMocks = vi.hoisted(() => ({
  listMaterials: vi.fn(),
}));

const geminiMock = vi.hoisted(() => ({ generateStructured: vi.fn() }));

const dbMocks = vi.hoisted(() => ({
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("../../src/modules/learningPlans/repository", () => repoMocks);
vi.mock("../../src/modules/learning/service", () => learningServiceMocks);
vi.mock("../../src/modules/assessment/service", () => assessmentServiceMocks);
vi.mock("../../src/modules/materials/service", () => materialsServiceMocks);
vi.mock("../../src/aiProvider", () => ({ geminiProvider: geminiMock }));
vi.mock("../../src/core/db", () => ({ db: dbMocks }));

const service = await import("../../src/modules/learningPlans/service");

const PROJECT = { id: "proj-1", learningGoal: "Understand cell biology" };

beforeEach(() => {
  vi.clearAllMocks();
  learningServiceMocks.getProjectForOwner.mockResolvedValue(PROJECT);
  assessmentServiceMocks.getGrowthOverview.mockResolvedValue([
    { conceptId: "concept-1", conceptName: "Mitochondria", level: 20, trend: "requires_attention", updatedAt: new Date() },
  ]);
  materialsServiceMocks.listMaterials.mockResolvedValue([{ id: "material-1", originalFilename: "cell_biology.pdf", status: "ready" }]);
  repoMocks.createPlan.mockImplementation(async (_projectId, _rationale, steps) => ({
    plan: { id: "plan-1" },
    steps: steps.map((s: unknown, i: number) => ({ id: `step-${i}`, ...(s as object) })),
  }));
});

describe("getPlan", () => {
  it("returns undefined when the project isn't owned", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    expect(await service.getPlan("proj-1", "user-1")).toBeUndefined();
  });

  it("returns an empty plan shape when no active plan exists yet", async () => {
    repoMocks.getActivePlanForProject.mockResolvedValue(undefined);
    expect(await service.getPlan("proj-1", "user-1")).toEqual({ plan: null, steps: [] });
  });

  it("returns the active plan and its steps", async () => {
    repoMocks.getActivePlanForProject.mockResolvedValue({ plan: { id: "plan-1" }, steps: [{ id: "step-1" }] });
    expect(await service.getPlan("proj-1", "user-1")).toEqual({ plan: { id: "plan-1" }, steps: [{ id: "step-1" }] });
  });
});

describe("generatePlan", () => {
  it("returns undefined when the project isn't owned", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    expect(await service.generatePlan("proj-1", "user-1")).toBeUndefined();
    expect(geminiMock.generateStructured).not.toHaveBeenCalled();
  });

  it("archives the previous active plan before creating the new one", async () => {
    geminiMock.generateStructured.mockResolvedValue({
      steps: [{ type: "quiz", description: "Take a quiz on Mitochondria", relatedMaterialId: null, relatedConceptId: "concept-1" }],
    });

    await service.generatePlan("proj-1", "user-1");

    expect(repoMocks.archiveActivePlans).toHaveBeenCalledWith("proj-1");
    expect(repoMocks.archiveActivePlans.mock.invocationCallOrder[0]!).toBeLessThan(repoMocks.createPlan.mock.invocationCallOrder[0]!);
  });

  it("keeps a relatedConceptId/relatedMaterialId that matches a real concept/material", async () => {
    geminiMock.generateStructured.mockResolvedValue({
      steps: [
        { type: "material", description: "Review the cell biology PDF", relatedMaterialId: "material-1", relatedConceptId: null },
        { type: "quiz", description: "Take a quiz on Mitochondria", relatedMaterialId: null, relatedConceptId: "concept-1" },
      ],
    });

    await service.generatePlan("proj-1", "user-1");

    const [, , steps] = repoMocks.createPlan.mock.calls[0]!;
    expect(steps[0]).toMatchObject({ relatedMaterialId: "material-1", relatedConceptId: null });
    expect(steps[1]).toMatchObject({ relatedMaterialId: null, relatedConceptId: "concept-1" });
  });

  it("drops a hallucinated relatedMaterialId/relatedConceptId that doesn't match any real id", async () => {
    geminiMock.generateStructured.mockResolvedValue({
      steps: [
        { type: "material", description: "Review a material", relatedMaterialId: "made-up-id", relatedConceptId: null },
        { type: "quiz", description: "Take a quiz", relatedMaterialId: null, relatedConceptId: "made-up-concept" },
      ],
    });

    await service.generatePlan("proj-1", "user-1");

    const [, , steps] = repoMocks.createPlan.mock.calls[0]!;
    expect(steps[0].relatedMaterialId).toBeNull();
    expect(steps[1].relatedConceptId).toBeNull();
  });

  it("emits a learning_plan_generated event", async () => {
    geminiMock.generateStructured.mockResolvedValue({
      steps: [{ type: "other", description: "Review your notes", relatedMaterialId: null, relatedConceptId: null }],
    });

    await service.generatePlan("proj-1", "user-1");

    expect(dbMocks.insert).toHaveBeenCalled();
  });
});

describe("setStepCompleted", () => {
  it("returns undefined when the project isn't owned", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    expect(await service.setStepCompleted("step-1", "proj-1", "user-1", true)).toBeUndefined();
    expect(repoMocks.setStepCompleted).not.toHaveBeenCalled();
  });

  it("returns undefined when the step doesn't belong to this project", async () => {
    repoMocks.getStepWithPlanForOwner.mockResolvedValue(undefined);
    expect(await service.setStepCompleted("step-1", "proj-1", "user-1", true)).toBeUndefined();
    expect(repoMocks.setStepCompleted).not.toHaveBeenCalled();
  });

  it("marks a step completed", async () => {
    repoMocks.getStepWithPlanForOwner.mockResolvedValue({ step: { id: "step-1" }, plan: { id: "plan-1" } });
    repoMocks.setStepCompleted.mockResolvedValue({ id: "step-1", completed: true });

    const result = await service.setStepCompleted("step-1", "proj-1", "user-1", true);
    expect(result).toEqual({ id: "step-1", completed: true });
    expect(repoMocks.setStepCompleted).toHaveBeenCalledWith("step-1", true);
  });
});
