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
  generateTextStream: vi.fn(),
}));

const learningServiceMocks = vi.hoisted(() => ({
  getProjectForOwner: vi.fn(),
}));

const materialsServiceMocks = vi.hoisted(() => ({
  getFilenamesByIds: vi.fn(),
}));

vi.mock("../../src/modules/ai/repository", () => repoMocks);
vi.mock("../../src/modules/ai/retrieval", () => retrievalMocks);
vi.mock("../../src/aiProvider", () => ({ geminiProvider: aiProviderMocks, GEMINI_TEXT_MODEL: "gemini-3.6-flash" }));
vi.mock("../../src/modules/learning/service", () => learningServiceMocks);
vi.mock("../../src/modules/materials/service", () => materialsServiceMocks);

const { handleTutorMessage, handleTutorMessageStream } = await import("../../src/modules/ai/service");

/** Wraps an array of raw provider chunks as the async generator handleTutorMessageStream expects. */
async function* fakeStream(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) yield chunk;
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

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

  it("fetches recent message history before saving the current turn's message, so the new message isn't duplicated into that history window", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 14, content: "gradient descent minimizes loss", similarity: 0.9 },
    ]);
    aiProviderMocks.generateStructured.mockResolvedValue({ insufficientEvidence: false, answer: "answer", citations: [] });

    const callOrder: string[] = [];
    repoMocks.getRecentMessages.mockImplementation(async () => {
      callOrder.push("getRecentMessages");
      return [];
    });
    repoMocks.saveMessage.mockImplementation(async () => {
      callOrder.push("saveMessage");
    });

    await handleTutorMessage("proj-1", "user-1", "What is gradient descent?", undefined);

    expect(callOrder.indexOf("getRecentMessages")).toBeLessThan(callOrder.indexOf("saveMessage"));
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

describe("handleTutorMessageStream", () => {
  it("returns undefined when the project isn't found/owned", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    const stream = await handleTutorMessageStream("proj-1", "user-1", "question", undefined);
    expect(stream).toBeUndefined();
  });

  it("streams the canned insufficient-evidence reply without calling the model when retrieval finds nothing", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([]);

    const stream = await handleTutorMessageStream("proj-1", "user-1", "off-topic question", undefined);
    const events = await collect(stream!);

    expect(aiProviderMocks.generateTextStream).not.toHaveBeenCalled();
    expect(events[0]).toEqual({ type: "start", conversationId: "conv-1" });
    expect(events.at(-1)).toEqual({ type: "done", citations: [], insufficientEvidence: true, groundingUncertain: false });
  });

  it("streams prose token-by-token and emits validated citations once the tail is parsed", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 14, content: "gradient descent minimizes loss", similarity: 0.92 },
    ]);
    aiProviderMocks.generateTextStream.mockReturnValue(
      fakeStream([
        "Gradient descent ",
        "minimizes the loss function.",
        "\n---CITATIONS_JSON---\n",
        '{"insufficientEvidence":false,"citations":[{"materialId":"mat-1","page":14}]}',
      ]),
    );

    const stream = await handleTutorMessageStream("proj-1", "user-1", "What is gradient descent?", undefined);
    const events = await collect(stream!);

    const tokenEvents = events.filter((e) => e.type === "token");
    expect(tokenEvents.map((e) => e.delta).join("")).toBe("Gradient descent minimizes the loss function.");
    expect(events.at(-1)).toEqual({
      type: "done",
      citations: [{ materialId: "mat-1", materialName: "Machine Learning Notes", page: 14 }],
      insufficientEvidence: false,
      groundingUncertain: false,
    });
    expect(repoMocks.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "assistant", content: "Gradient descent minimizes the loss function." }),
    );
  });

  it("reassembles a delimiter split across two provider chunks without leaking a partial delimiter as a token", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 1, content: "evidence", similarity: 0.9 },
    ]);
    aiProviderMocks.generateTextStream.mockReturnValue(
      fakeStream([
        "The answer.\n---CITATIONS_JS",
        'ON---\n{"insufficientEvidence":false,"citations":[{"materialId":"mat-1","page":1}]}',
      ]),
    );

    const stream = await handleTutorMessageStream("proj-1", "user-1", "question", undefined);
    const events = await collect(stream!);

    const tokenEvents = events.filter((e) => e.type === "token");
    expect(tokenEvents.map((e) => e.delta).join("")).toBe("The answer.");
    expect(events.at(-1)).toMatchObject({ type: "done", insufficientEvidence: false, groundingUncertain: false });
  });

  it("flags groundingUncertain rather than hiding already-streamed prose when citations don't validate", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 14, content: "real evidence", similarity: 0.9 },
    ]);
    aiProviderMocks.generateTextStream.mockReturnValue(
      fakeStream(["Some streamed prose.", "\n---CITATIONS_JSON---\n", '{"insufficientEvidence":false,"citations":[{"materialId":"mat-1","page":999}]}']),
    );

    const stream = await handleTutorMessageStream("proj-1", "user-1", "question", undefined);
    const events = await collect(stream!);

    const tokenEvents = events.filter((e) => e.type === "token");
    expect(tokenEvents.map((e) => e.delta).join("")).toBe("Some streamed prose.");
    expect(events.some((e) => e.type === "notice")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done", citations: [], insufficientEvidence: false, groundingUncertain: true });
    expect(repoMocks.saveMessage).toHaveBeenCalledWith(expect.objectContaining({ content: "Some streamed prose.", citations: [] }));
  });

  it("keeps the model's own brief note when it declares insufficientEvidence in the tail after streaming some prose", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 1, content: "loosely related", similarity: 0.51 },
    ]);
    aiProviderMocks.generateTextStream.mockReturnValue(
      fakeStream(["I don't see enough evidence for that.", "\n---CITATIONS_JSON---\n", '{"insufficientEvidence":true,"citations":[]}']),
    );

    const stream = await handleTutorMessageStream("proj-1", "user-1", "tangential question", undefined);
    const events = await collect(stream!);

    const tokenEvents = events.filter((e) => e.type === "token");
    expect(tokenEvents.map((e) => e.delta).join("")).toBe("I don't see enough evidence for that.");
    expect(events.at(-1)).toEqual({ type: "done", citations: [], insufficientEvidence: true, groundingUncertain: false });
  });

  it("falls back to the canned insufficient-evidence reply when the model never emits the delimiter and produced no real prose", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 1, content: "evidence", similarity: 0.9 },
    ]);
    aiProviderMocks.generateTextStream.mockReturnValue(fakeStream(["   "]));

    const stream = await handleTutorMessageStream("proj-1", "user-1", "question", undefined);
    const events = await collect(stream!);

    expect(events.at(-1)).toEqual({ type: "done", citations: [], insufficientEvidence: true, groundingUncertain: false });
  });

  it("emits an error event and persists nothing when the provider fails mid-stream", async () => {
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue([
      { materialId: "mat-1", pageNumber: 1, content: "evidence", similarity: 0.9 },
    ]);
    aiProviderMocks.generateTextStream.mockReturnValue(
      (async function* () {
        yield "Partial answer";
        throw new Error("stream interrupted");
      })(),
    );

    const stream = await handleTutorMessageStream("proj-1", "user-1", "question", undefined);
    const events = await collect(stream!);

    expect(events.at(-1)).toEqual({ type: "error", message: "The Tutor's response was interrupted." });
    expect(repoMocks.saveMessage).not.toHaveBeenCalledWith(expect.objectContaining({ role: "assistant" }));
  });
});
