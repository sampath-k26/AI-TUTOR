import { and, desc, eq } from "drizzle-orm";
import { db } from "../../core/db";
import { profiles, projects, spaces } from "../../../db/schema";
import type { CreateProjectInput, CreateSpaceInput } from "./schemas";

/**
 * Every query here is scoped by ownerId (defense layer 1 of decision D16) — a row
 * belonging to another user is indistinguishable from a row that doesn't exist,
 * so callers should treat "not found" as the only failure case (never leak 403 vs 404).
 */

export async function getOrCreateProfile(userId: string, email: string) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(profiles)
    .values({ id: userId, email })
    .onConflictDoNothing({ target: profiles.id })
    .returning();

  if (created) return created;

  // Lost a race with a concurrent request creating the same profile — re-read.
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row;
}

export async function listSpacesByOwner(ownerId: string) {
  return db.select().from(spaces).where(eq(spaces.ownerId, ownerId)).orderBy(desc(spaces.createdAt));
}

export async function getSpaceByIdForOwner(spaceId: string, ownerId: string) {
  const [space] = await db
    .select()
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.ownerId, ownerId)))
    .limit(1);
  return space;
}

export async function createSpace(ownerId: string, input: CreateSpaceInput) {
  const [space] = await db
    .insert(spaces)
    .values({ ownerId, name: input.name, description: input.description, theme: input.theme })
    .returning();
  return space;
}

export async function listProjectsBySpaceForOwner(spaceId: string, ownerId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.spaceId, spaceId), eq(projects.ownerId, ownerId)))
    .orderBy(desc(projects.createdAt));
}

export async function listProjectsByOwner(ownerId: string) {
  return db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.createdAt));
}

export async function getProjectByIdForOwner(projectId: string, ownerId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return project;
}

/** No ownership filter — for internal/background-job use only (the job was enqueued by an already-authorized request), never from a request handler. */
export async function getProjectById(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return project;
}

export async function createProject(spaceId: string, ownerId: string, input: CreateProjectInput) {
  const [project] = await db
    .insert(projects)
    .values({
      spaceId,
      ownerId,
      name: input.name,
      description: input.description,
      learningGoal: input.learningGoal,
    })
    .returning();
  return project;
}
