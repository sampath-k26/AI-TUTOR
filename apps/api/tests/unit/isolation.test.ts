import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Decision D16 (defense in depth): the service layer is the first line of
 * defense against cross-project access — every project-scoped service
 * function must return undefined (which every router maps to 404, never a
 * distinguishing 403) when the caller doesn't own the project, before it
 * ever reaches a repository. This is the unit-level half of that guarantee;
 * the live half (real JWTs, real Postgres, real RLS) was verified manually
 * end-to-end against the deployed Supabase project — every module returned
 * a consistent 404 for a real second user probing a real first user's
 * project across GET/POST routes, space listings, and global analytics.
 *
 * These tests exist so a future service function that forgets the ownership
 * check fails a test immediately, instead of shipping a real data leak.
 */

const learningServiceMocks = vi.hoisted(() => ({
  getProjectForOwner: vi.fn(),
}));
vi.mock("../../src/modules/learning/service", () => learningServiceMocks);

const materialsRepoMocks = vi.hoisted(() => ({
  createQueuedMaterial: vi.fn(),
  listMaterialsForProject: vi.fn(),
}));
vi.mock("../../src/modules/materials/repository", () => materialsRepoMocks);
vi.mock("../../src/core/storage", () => ({ uploadMaterialFile: vi.fn() }));
vi.mock("../../src/aiProvider", () => ({ geminiProvider: { embed: vi.fn() } }));
vi.mock("../../src/workers/processMaterial", () => ({ enqueueProcessMaterial: vi.fn() }));

const analyticsRepoMocks = vi.hoisted(() => ({
  getProjectEventCounts: vi.fn(),
  getProjectAssessmentStats: vi.fn(),
  getProjectMasterySummary: vi.fn(),
  getProjectAiUsageSummary: vi.fn(),
}));
vi.mock("../../src/modules/analytics/repository", () => analyticsRepoMocks);

const materialsService = await import("../../src/modules/materials/service");
const analyticsService = await import("../../src/modules/analytics/service");

const OTHER_USERS_PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const ATTACKER_ID = "attacker-user-id";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cross-project isolation — materials module", () => {
  it("uploadMaterial refuses to attach a file to a project the caller doesn't own", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    const result = await materialsService.uploadMaterial(
      OTHER_USERS_PROJECT_ID,
      ATTACKER_ID,
      { buffer: Buffer.from("x"), originalname: "x.pdf", mimetype: "application/pdf" } as unknown as Express.Multer.File,
    );
    expect(result).toBeUndefined();
    expect(materialsRepoMocks.createQueuedMaterial).not.toHaveBeenCalled();
  });

  it("listMaterials returns undefined for a project the caller doesn't own", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    const result = await materialsService.listMaterials(OTHER_USERS_PROJECT_ID, ATTACKER_ID);
    expect(result).toBeUndefined();
    expect(materialsRepoMocks.listMaterialsForProject).not.toHaveBeenCalled();
  });
});

describe("cross-project isolation — analytics module", () => {
  it("getProjectAnalytics returns undefined for a project the caller doesn't own, without querying any usage data", async () => {
    learningServiceMocks.getProjectForOwner.mockResolvedValue(undefined);
    const result = await analyticsService.getProjectAnalytics(OTHER_USERS_PROJECT_ID, ATTACKER_ID);
    expect(result).toBeUndefined();
    expect(analyticsRepoMocks.getProjectEventCounts).not.toHaveBeenCalled();
    expect(analyticsRepoMocks.getProjectAiUsageSummary).not.toHaveBeenCalled();
  });
});
