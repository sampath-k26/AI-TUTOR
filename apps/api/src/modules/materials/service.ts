import { randomUUID } from "node:crypto";
import { getProjectForOwner } from "../learning/service";
import { uploadMaterialFile } from "../../core/storage";
import { enqueueProcessMaterial } from "../../workers/processMaterial";
import * as repo from "./repository";

export async function uploadMaterial(projectId: string, ownerId: string, file: Express.Multer.File) {
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) return undefined;

  const storagePath = `${projectId}/${randomUUID()}-${file.originalname}`;
  await uploadMaterialFile(storagePath, file.buffer, file.mimetype);

  const material = await repo.createQueuedMaterial(projectId, storagePath, file.originalname);
  if (material) {
    await enqueueProcessMaterial({ materialId: material.id, projectId, filePath: storagePath });
  }

  return material;
}

export async function listMaterials(projectId: string, ownerId: string) {
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) return undefined;
  return repo.listMaterialsForProject(projectId, ownerId);
}

export async function getMaterial(materialId: string, ownerId: string) {
  return repo.getMaterialForOwner(materialId, ownerId);
}

/** Used by other modules (e.g. ai) to render citations without querying the materials table directly. */
export async function getFilenamesByIds(materialIds: string[]) {
  return repo.getFilenamesByIds(materialIds);
}
