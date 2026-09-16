import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  getOrCreateConversation: vi.fn(),
  getRecentMessages: vi.fn(),
  getRelevantLearningContext: vi.fn(),
  saveMessage: vi.fn(),
}));

const retrievalMocks = vi.hoisted(() => ({
  retrieveRelevantChunks: vi.fn(),
}));

const aiProviderMocks = vi.hoisted(() => ({
  generateStructured: vi.fn(),
}));

const learningServiceMocks = vi.hoisted(() => ({
  getProjectForOwner: vi.fn(),
}));

const materialsServiceMocks = vi.hoisted(() => ({
  getFilenamesByIds: vi.fn(),
}));

vi.mock("../../src/modules/ai/repository", () => repoMocks);
vi.mock("../../src/modules/ai/retrieval", () => retrievalMocks);
vi.mock("../../src/aiProvider", () => ({ geminiProvider: aiProviderMocks }));
vi.mock("../../src/modules/learning/service", () => learningServiceMocks);
vi.mock("../../src/modules/materials/service", () => materialsServiceMocks);

const { handleTutorMessage } = await import("../../src/modules/ai/service");

const PROJECT = { id: "proj-1", name: "ML Basics", learningGoal: "Understand gradient descent" };
const CONVERSATION = { id: "conv-1" };

beforeEach(() => {
  vi.clearAllMocks();
  learningServiceMocks.getProjectForOwner.mockResolvedValue(PROJECT);
  repoMocks.getOrCreateConversation.mockResolvedValue(CONVERSATION);
  repoMocks.getRecentMessages.mockResolvedValue([]);
  repoMocks.getRelevantLearningContext.mockResolvedValue([]);
  materialsServiceMocks.getFilenamesByIds.mockResolvedValue(new Map([["mat-1", "Machine Learning Notes"]]));
  repoMocks.saveMessage.mockResolvedValue(undefined);
});

describe("handleTutorMessage", () => {
  it("returns undefined when the project isn't found/owned (never leaks existence)", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    const result = await handleTutorMessage("proj-1", "user-1", "What is gradient descent?", undefined);
    expect(result).toBeUndefined();
    expect(aiProviderMocks.generateStructured).not.toHaveBeenCalled();
  });

  it("returns insufficient-evidence without calling the model when retrieval finds nothing", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([]);

    const result = await handleTutorMessage("proj-1", "user-1", "What is quantum computing?", undefined);

    expect(result?.insufficientEvidence).toBe(true);
    expect(aiProviderMocks.generateStructured).not.toHaveBeenCalled();
  });

  it("respects the model's own insufficientEvidence signal", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 3, content: "loosely related text", similarity: 0.51 },
    ]);
    aiProviderMocks.generateStructured.mockResolvedValue({ insufficientEvidence: true, answer: "", citations: [] });

    const result = await handleTutorMessage("proj-1", "user-1", "some tangential question", undefined);

    expect(result?.insufficientEvidence).toBe(true);
    expect(result?.answer).not.toBe("");
  });

  it("treats a fabricated citation (not matching any retrieved chunk) as ungrounded", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 3, content: "gradient descent minimizes loss", similarity: 0.9 },
    ]);
    aiProviderMocks.generateStructured.mockResolvedValue({
      insufficientEvidence: false,
      answer: "Gradient descent is an optimization algorithm.",
      citations: [{ materialId: "mat-1", page: 99 }], // page 99 was never retrieved
    });

    const result = await handleTutorMessage("proj-1", "user-1", "What is gradient descent?", undefined);

    expect(result?.insufficientEvidence).toBe(true);
  });

  it("returns a grounded answer with citations when the model's citations match retrieved evidence", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 14, content: "gradient descent minimizes loss iteratively", similarity: 0.92 },
    ]);
    aiProviderMocks.generateStructured.mockResolvedValue({
      insufficientEvidence: false,
      answer: "Gradient descent iteratively minimizes the loss function.",
      citations: [{ materialId: "mat-1", page: 14 }],
    });

    const result = await handleTutorMessage("proj-1", "user-1", "What is gradient descent?", undefined);

    expect(result?.insufficientEvidence).toBe(false);
    expect(result?.citations).toEqual([{ materialId: "mat-1", materialName: "Machine Learning Notes", page: 14 }]);
  });

  it("drops only the fabricated citations while keeping any that do match retrieved evidence", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 14, content: "real evidence", similarity: 0.92 },
    ]);
    aiProviderMocks.generateStructured.mockResolvedValue({
      insufficientEvidence: false,
      answer: "Answer citing one real and one fabricated source.",
      citations: [
        { materialId: "mat-1", page: 14 }, // matches retrieved evidence
        { materialId: "mat-1", page: 999 }, // fabricated
      ],
    });

    const result = await handleTutorMessage("proj-1", "user-1", "question", undefined);

    expect(result?.insufficientEvidence).toBe(false);
    expect(result?.citations).toEqual([{ materialId: "mat-1", materialName: "Machine Learning Notes", page: 14 }]);
  });
});
