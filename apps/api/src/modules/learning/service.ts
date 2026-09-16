import { db } from "../../core/db";
import { events } from "../../../db/schema";
import * as repo from "./repository";
import type { CreateProjectInput, CreateSpaceInput } from "./schemas";

export async function ensureProfile(userId: string, email: string) {
  return repo.getOrCreateProfile(userId, email);
}

export async function listSpaces(ownerId: string) {
  return repo.listSpacesByOwner(ownerId);
}

export async function createSpace(ownerId: string, input: CreateSpaceInput) {
  return repo.createSpace(ownerId, input);
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

/** Returns undefined if the project doesn't exist or isn't owned by this user — router maps that to 404. */
export async function getProjectDashboard(projectId: string, ownerId: string) {
  return repo.getProjectByIdForOwner(projectId, ownerId);
}
