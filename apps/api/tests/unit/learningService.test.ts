import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * learning/service.ts is the module that OWNS spaces/projects (decision D16) —
 * every other module's ownership check ultimately traces back to
 * getProjectForOwner here, so its own "not owned" behavior is the root of the
 * isolation guarantee tested from the other side in tests/unit/isolation.test.ts.
 */

const repoMocks = vi.hoisted(() => ({
  getSpaceByIdForOwner: vi.fn(),
  listProjectsBySpaceForOwner: vi.fn(),
  createProject: vi.fn(),
  getProjectByIdForOwner: vi.fn(),
}));
vi.mock("../../src/modules/learning/repository", () => repoMocks);
vi.mock("../../src/core/db", () => ({ db: { insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) } }));

const service = await import("../../src/modules/learning/service");

const ATTACKER_ID = "attacker-user-id";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSpaceDashboard", () => {
  it("returns undefined for a space the caller doesn't own, without listing its projects", async () => {
    repoMocks.getSpaceByIdForOwner.mockResolvedValue(undefined);
    const result = await service.getSpaceDashboard("someone-elses-space", ATTACKER_ID);
    expect(result).toBeUndefined();
    expect(repoMocks.listProjectsBySpaceForOwner).not.toHaveBeenCalled();
  });
});

describe("createProject", () => {
  it("refuses to create a project under a space the caller doesn't own", async () => {
    repoMocks.getSpaceByIdForOwner.mockResolvedValue(undefined);
    const result = await service.createProject("someone-elses-space", ATTACKER_ID, {
      name: "hijack",
      description: "x",
      learningGoal: "x",
    });
    expect(result).toBeUndefined();
    expect(repoMocks.createProject).not.toHaveBeenCalled();
  });
});

describe("getProjectForOwner / getProjectDashboard", () => {
  it("returns undefined for a project the caller doesn't own", async () => {
    repoMocks.getProjectByIdForOwner.mockResolvedValue(undefined);
    expect(await service.getProjectDashboard("someone-elses-project", ATTACKER_ID)).toBeUndefined();
    expect(await service.getProjectForOwner("someone-elses-project", ATTACKER_ID)).toBeUndefined();
  });

  it("returns the project when the caller does own it", async () => {
    const project = { id: "proj-1", ownerId: "owner-1", name: "Real Project" };
    repoMocks.getProjectByIdForOwner.mockResolvedValue(project);
    expect(await service.getProjectForOwner("proj-1", "owner-1")).toEqual(project);
  });
});
