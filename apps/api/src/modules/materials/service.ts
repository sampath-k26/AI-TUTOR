import { randomUUID } from "node:crypto";
import { getProjectByIdForOwner } from "../learning/repository";
import { uploadMaterialFile } from "../../core/storage";
import { enqueueProcessMaterial } from "../../workers/processMaterial";
import * as repo from "./repository";

export async function uploadMaterial(projectId: string, ownerId: string, file: Express.Multer.File) {
  const project = await getProjectByIdForOwner(projectId, ownerId);
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
  const project = await getProjectByIdForOwner(projectId, ownerId);
  if (!project) return undefined;
  return repo.listMaterialsForProject(projectId, ownerId);
}

export async function getMaterial(materialId: string, ownerId: string) {
  return repo.getMaterialForOwner(materialId, ownerId);
}
