import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Background-processing testing strategy (docs/06-IMPLEMENTATION-PLAN.md):
 * a failure partway through must mark the material `failed` (so the user sees
 * why, per PRD §13's observability requirement) AND re-throw, so pg-boss's own
 * retry policy (decision A3/D13, retryLimit: 3 in bossClient.ts) actually gets
 * a chance to retry the job instead of the failure being silently swallowed.
 */

const bossMocks = vi.hoisted(() => ({
  boss: { work: vi.fn() },
  ensureBossStarted: vi.fn().mockResolvedValue(undefined),
  QUEUE_NAMES: { processMaterial: "process-material", generateRecommendation: "generate-recommendation" },
}));
vi.mock("../../src/workers/bossClient", () => bossMocks);

const repoMocks = vi.hoisted(() => ({
  markProcessing: vi.fn(),
  markFailed: vi.fn(),
  markReady: vi.fn(),
  insertChunks: vi.fn(),
  insertConcepts: vi.fn(),
  listConceptNamesForProject: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../src/modules/materials/repository", () => repoMocks);

const storageMocks = vi.hoisted(() => ({ downloadMaterialFile: vi.fn() }));
vi.mock("../../src/core/storage", () => storageMocks);
vi.mock("../../src/aiProvider", () => ({ geminiProvider: { embed: vi.fn().mockResolvedValue([]) } }));
vi.mock("../../src/modules/materials/processing/extract", () => ({
  extractPdfPages: vi.fn().mockResolvedValue([{ pageNumber: 1, text: "some page text" }]),
  needsVisionFallback: vi.fn(() => false),
}));
vi.mock("../../src/modules/materials/processing/visionFallback", () => ({
  renderPagesToPngBase64: vi.fn(),
  extractPagesTextViaVisionBatch: vi.fn(),
}));
vi.mock("../../src/modules/materials/processing/chunking", () => ({ chunkPages: vi.fn(() => []) }));
vi.mock("../../src/modules/materials/processing/conceptExtraction", () => ({ extractConcepts: vi.fn().mockResolvedValue([]) }));

const { registerProcessMaterialWorker } = await import("../../src/workers/processMaterial");

async function getRegisteredHandler() {
  await registerProcessMaterialWorker();
  const call = bossMocks.boss.work.mock.calls.at(-1);
  return call?.[1] as (jobs: unknown[]) => Promise<void>;
}

const JOB = { data: { materialId: "mat-1", projectId: "proj-1", filePath: "proj-1/mat-1.pdf" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processMaterial worker", () => {
  it("marks the material failed and re-throws when a step fails, so pg-boss retries", async () => {
    storageMocks.downloadMaterialFile.mockRejectedValue(new Error("storage down"));
    const handler = await getRegisteredHandler();

    await expect(handler([JOB])).rejects.toThrow("storage down");

    expect(repoMocks.markFailed).toHaveBeenCalledWith("mat-1", "storage down");
    expect(repoMocks.markReady).not.toHaveBeenCalled();
  });

  it("marks the material ready on a clean run, without marking it failed", async () => {
    storageMocks.downloadMaterialFile.mockResolvedValue(Buffer.from("pdf bytes"));
    const handler = await getRegisteredHandler();

    await handler([JOB]);

    expect(repoMocks.markReady).toHaveBeenCalledWith("mat-1", 1);
    expect(repoMocks.markFailed).not.toHaveBeenCalled();
  });
});
