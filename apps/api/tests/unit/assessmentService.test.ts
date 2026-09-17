import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  createQuiz: vi.fn(),
  getQuizForProject: vi.fn(),
  completeQuiz: vi.fn(),
  getConceptCandidates: vi.fn(),
  getRecentlyAskedConceptIds: vi.fn(),
  createQuestion: vi.fn(),
  getQuestionForProject: vi.fn(),
  getResponseForQuestion: vi.fn(),
  createResponse: vi.fn(),
  getMasteryState: vi.fn(),
  upsertMastery: vi.fn(),
  insertGrowthSnapshot: vi.fn(),
  getLatestGrowthForConcept: vi.fn(),
}));

const learningServiceMocks = vi.hoisted(() => ({
  getProjectForOwner: vi.fn(),
}));

const materialsServiceMocks = vi.hoisted(() => ({
  searchRelevantChunks: vi.fn(),
  getConceptById: vi.fn(),
}));

const geminiMock = vi.hoisted(() => ({ generateStructured: vi.fn() }));
const groqMock = vi.hoisted(() => ({ generateStructured: vi.fn() }));

const dbMocks = vi.hoisted(() => ({
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("../../src/modules/assessment/repository", () => repoMocks);
vi.mock("../../src/modules/learning/service", () => learningServiceMocks);
vi.mock("../../src/modules/materials/service", () => materialsServiceMocks);
vi.mock("../../src/aiProvider", () => ({ geminiProvider: geminiMock, groqProvider: groqMock }));
vi.mock("../../src/core/db", () => ({ db: dbMocks }));

const service = await import("../../src/modules/assessment/service");

const PROJECT = { id: "proj-1", name: "ML Basics" };

beforeEach(() => {
  vi.clearAllMocks();
  learningServiceMocks.getProjectForOwner.mockResolvedValue(PROJECT);
  materialsServiceMocks.searchRelevantChunks.mockResolvedValue([{ content: "gradient descent minimizes loss" }]);
  materialsServiceMocks.getConceptById.mockResolvedValue({ id: "concept-1", name: "Gradient Descent", projectId: "proj-1" });
  repoMocks.getResponseForQuestion.mockResolvedValue(undefined); // no prior answer, unless a test says otherwise
});

describe("startQuiz", () => {
  it("returns undefined when the project isn't owned", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    expect(await service.startQuiz("proj-1", "user-1")).toBeUndefined();
    expect(repoMocks.createQuiz).not.toHaveBeenCalled();
  });

  it("creates a quiz for an owned project", async () => {
    repoMocks.createQuiz.mockResolvedValue({ id: "quiz-1", projectId: "proj-1" });
    const quiz = await service.startQuiz("proj-1", "user-1");
    expect(quiz).toEqual({ id: "quiz-1", projectId: "proj-1" });
  });
});

describe("generateNextQuestion", () => {
  beforeEach(() => {
    repoMocks.getQuizForProject.mockResolvedValue({ id: "quiz-1", projectId: "proj-1" });
  });

  it("signals when no concepts exist yet", async () => {
    repoMocks.getConceptCandidates.mockResolvedValue([]);
    repoMocks.getRecentlyAskedConceptIds.mockResolvedValue([]);

    const result = await service.generateNextQuestion("quiz-1", "proj-1", "user-1");
    expect(result).toEqual({ noConceptsAvailable: true });
  });

  it("generates an MCQ via Groq when an even number of questions have been asked so far", async () => {
    repoMocks.getConceptCandidates.mockResolvedValue([{ conceptId: "concept-1", masteryLevel: 20, lastEvidenceAt: null }]);
    repoMocks.getRecentlyAskedConceptIds.mockResolvedValue([]); // length 0 -> even -> mcq
    groqMock.generateStructured.mockResolvedValue({ prompt: "What is gradient descent?", options: ["A", "B", "C", "D"], correctIndex: 1 });
    repoMocks.createQuestion.mockResolvedValue({ id: "q-1", type: "mcq" });

    const result = await service.generateNextQuestion("quiz-1", "proj-1", "user-1");

    expect(groqMock.generateStructured).toHaveBeenCalledOnce();
    expect(geminiMock.generateStructured).not.toHaveBeenCalled();
    expect(result).toMatchObject({ question: { id: "q-1", type: "mcq" } });
  });

  it("generates an open-ended question via Gemini when an odd number of questions have been asked so far", async () => {
    repoMocks.getConceptCandidates.mockResolvedValue([{ conceptId: "concept-1", masteryLevel: 20, lastEvidenceAt: null }]);
    repoMocks.getRecentlyAskedConceptIds.mockResolvedValue(["concept-1"]); // length 1 -> odd -> open_ended
    geminiMock.generateStructured.mockResolvedValue({ prompt: "Explain gradient descent.", expectedKeyPoints: ["iterative", "minimizes loss"] });
    repoMocks.createQuestion.mockResolvedValue({ id: "q-2", type: "open_ended" });

    const result = await service.generateNextQuestion("quiz-1", "proj-1", "user-1");

    expect(geminiMock.generateStructured).toHaveBeenCalledOnce();
    expect(groqMock.generateStructured).not.toHaveBeenCalled();
    expect(result).toMatchObject({ question: { id: "q-2", type: "open_ended" } });
  });
});

describe("submitAnswer", () => {
  it("grades an MCQ deterministically without calling any AI provider", async () => {
    repoMocks.getQuestionForProject.mockResolvedValue({
      id: "q-1",
      conceptId: "concept-1",
      type: "mcq",
      difficulty: 3,
      answerKey: { correctIndex: 2 },
    });
    repoMocks.createResponse.mockResolvedValue({ response: { id: "resp-1" }, wasAlreadyAnswered: false });
    repoMocks.getMasteryState.mockResolvedValue(undefined);

    const result = await service.submitAnswer("q-1", "proj-1", "user-1", "2");

    expect(geminiMock.generateStructured).not.toHaveBeenCalled();
    expect(result?.evaluation).toMatchObject({ isCorrect: true, correctIndex: 2, submittedIndex: 2 });
  });

  it("grades an open-ended answer via Gemini with an explanation, not just a score", async () => {
    repoMocks.getQuestionForProject.mockResolvedValue({
      id: "q-2",
      conceptId: "concept-1",
      type: "open_ended",
      difficulty: 3,
      prompt: "Explain gradient descent.",
      answerKey: { expectedKeyPoints: ["iterative", "minimizes loss"] },
    });
    repoMocks.createResponse.mockResolvedValue({ response: { id: "resp-2" }, wasAlreadyAnswered: false });
    repoMocks.getMasteryState.mockResolvedValue(undefined);
    geminiMock.generateStructured.mockResolvedValue({
      understanding: "partial",
      accuracy: 0.6,
      keyConceptsCovered: ["iterative"],
      missingConcepts: ["minimizes loss"],
      feedbackText: "You covered the iterative nature but missed the loss-minimization goal.",
    });

    const result = await service.submitAnswer("q-2", "proj-1", "user-1", "It repeats many times.");
    const evaluation = result?.evaluation as { feedbackText: string; missingConcepts: string[] };

    expect(geminiMock.generateStructured).toHaveBeenCalledOnce();
    expect(evaluation.feedbackText).toContain("missed");
    expect(evaluation.missingConcepts).toEqual(["minimizes loss"]);
  });

  it("classifies growth as improving when mastery rises meaningfully", async () => {
    repoMocks.getQuestionForProject.mockResolvedValue({
      id: "q-1",
      conceptId: "concept-1",
      type: "mcq",
      difficulty: 5,
      answerKey: { correctIndex: 0 },
    });
    repoMocks.createResponse.mockResolvedValue({ response: { id: "resp-1" }, wasAlreadyAnswered: false });
    repoMocks.getMasteryState.mockResolvedValue({ level: "10", evidenceCount: 1, lastEvidenceAt: new Date() });

    const result = await service.submitAnswer("q-1", "proj-1", "user-1", "0");

    expect(result?.trend).toBe("improving");
    expect(repoMocks.insertGrowthSnapshot).toHaveBeenCalledWith(expect.objectContaining({ trend: "improving" }));
  });

  it("classifies growth as requires_attention when mastery drops meaningfully", async () => {
    repoMocks.getQuestionForProject.mockResolvedValue({
      id: "q-1",
      conceptId: "concept-1",
      type: "mcq",
      difficulty: 3,
      answerKey: { correctIndex: 0 },
    });
    repoMocks.createResponse.mockResolvedValue({ response: { id: "resp-1" }, wasAlreadyAnswered: false });
    repoMocks.getMasteryState.mockResolvedValue({ level: "80", evidenceCount: 10, lastEvidenceAt: new Date() });

    const result = await service.submitAnswer("q-1", "proj-1", "user-1", "1"); // wrong answer

    expect(result?.trend).toBe("requires_attention");
  });

  it("returns the existing response instead of re-grading a question that was already answered", async () => {
    repoMocks.getQuestionForProject.mockResolvedValue({
      id: "q-1",
      conceptId: "concept-1",
      type: "open_ended",
      difficulty: 3,
      prompt: "Explain gradient descent.",
      answerKey: { expectedKeyPoints: ["iterative"] },
    });
    repoMocks.getResponseForQuestion.mockResolvedValue({
      id: "resp-1",
      questionId: "q-1",
      evaluation: { understanding: "strong", feedbackText: "Nice work." },
    });
    repoMocks.getMasteryState.mockResolvedValue({ level: "55", evidenceCount: 2, lastEvidenceAt: new Date() });
    repoMocks.getLatestGrowthForConcept.mockResolvedValue({ trend: "improving" });

    const result = await service.submitAnswer("q-1", "proj-1", "user-1", "a second, different answer");

    expect(geminiMock.generateStructured).not.toHaveBeenCalled();
    expect(repoMocks.createResponse).not.toHaveBeenCalled();
    expect(repoMocks.upsertMastery).not.toHaveBeenCalled();
    expect(result).toEqual({
      response: { id: "resp-1", questionId: "q-1", evaluation: { understanding: "strong", feedbackText: "Nice work." } },
      evaluation: { understanding: "strong", feedbackText: "Nice work." },
      masteryLevel: 55,
      trend: "improving",
    });
  });

  it("returns the race-losing insert's existing response rather than throwing on a unique-constraint conflict", async () => {
    repoMocks.getQuestionForProject.mockResolvedValue({
      id: "q-1",
      conceptId: "concept-1",
      type: "mcq",
      difficulty: 2,
      answerKey: { correctIndex: 0 },
    });
    repoMocks.createResponse.mockResolvedValue({
      response: { id: "resp-winner", questionId: "q-1", evaluation: { isCorrect: true } },
      wasAlreadyAnswered: true,
    });
    repoMocks.getMasteryState.mockResolvedValue({ level: "40", evidenceCount: 1, lastEvidenceAt: new Date() });
    repoMocks.getLatestGrowthForConcept.mockResolvedValue({ trend: "stable" });

    const result = await service.submitAnswer("q-1", "proj-1", "user-1", "0");

    expect(repoMocks.upsertMastery).not.toHaveBeenCalled();
    expect(result?.response).toEqual({ id: "resp-winner", questionId: "q-1", evaluation: { isCorrect: true } });
  });
});
