import { db } from "../../core/db";
import { events } from "../../../db/schema";
import * as repo from "./repository";
import type { CreateProjectInput, CreateSpaceInput, ListProjectsQuery } from "./schemas";

export async function ensureProfile(userId: string, email: string) {
  return repo.getOrCreateProfile(userId, email);
}

export async function listSpaces(ownerId: string) {
  return repo.listSpacesByOwner(ownerId);
}

export async function createSpace(ownerId: string, input: CreateSpaceInput) {
  const space = await repo.createSpace(ownerId, input);

  if (space) {
    await db.insert(events).values({
      userId: ownerId,
      type: "space_created",
      payload: { spaceId: space.id, name: space.name },
    });
  }

  return space;
}

/** Returns undefined if the space doesn't exist or isn't owned by this user — router maps that to 404. */
export async function getSpaceDashboard(spaceId: string, ownerId: string) {
  const space = await repo.getSpaceByIdForOwner(spaceId, ownerId);
  if (!space) return undefined;

  const projects = await repo.listProjectsBySpaceForOwner(spaceId, ownerId);
  return { space, projects };
}

export async function createProject(spaceId: string, ownerId: string, input: CreateProjectInput) {
  const space = await repo.getSpaceByIdForOwner(spaceId, ownerId);
  if (!space) return undefined;

  const project = await repo.createProject(spaceId, ownerId, input);

  if (project) {
    await db.insert(events).values({
      userId: ownerId,
      projectId: project.id,
      type: "project_created",
      payload: { spaceId, name: project.name },
    });
  }

  return project;
}

export async function listAllProjects(ownerId: string) {
  return repo.listProjectsByOwner(ownerId);
}

const DEFAULT_PROJECTS_PAGE_SIZE = 10;

/** Sidebar's Projects list: search by name, filter by Space, paginated. */
export async function searchProjects(ownerId: string, query: ListProjectsQuery) {
  const limit = query.limit ?? DEFAULT_PROJECTS_PAGE_SIZE;
  const offset = query.offset ?? 0;

  const [projectRows, total] = await Promise.all([
    repo.listProjectsByOwner(ownerId, { ...query, limit, offset }),
    repo.countProjectsByOwner(ownerId, query),
  ]);

  return { projects: projectRows, total, limit, offset };
}

/** Returns undefined if the project doesn't exist or isn't owned by this user — router maps that to 404. */
export async function getProjectDashboard(projectId: string, ownerId: string) {
  return repo.getProjectByIdForOwner(projectId, ownerId);
}

/**
 * Ownership-check entry point for other modules (ai, materials, assessment, ...) —
 * they must not query the `projects` table directly (only learning/repository.ts
 * may, per CLAUDE.md's module-boundary rule); they call this instead.
 */
export async function getProjectForOwner(projectId: string, ownerId: string) {
  return repo.getProjectByIdForOwner(projectId, ownerId);
}

/** Background-job entry point (no ownerId available/needed there) — see repository.getProjectById's doc comment. */
export async function getProjectById(projectId: string) {
  return repo.getProjectById(projectId);
}
