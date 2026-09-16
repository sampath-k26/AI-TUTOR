import type PgBoss from "pg-boss";
import { downloadMaterialFile } from "../core/storage";
import { geminiProvider } from "../aiProvider";
import { extractPdfPages, needsVisionFallback, type ExtractedPage } from "../modules/materials/processing/extract";
import { renderPagesToPngBase64, extractPageTextViaVision } from "../modules/materials/processing/visionFallback";
import { chunkPages } from "../modules/materials/processing/chunking";
import { extractConcepts } from "../modules/materials/processing/conceptExtraction";
import * as repo from "../modules/materials/repository";
import { boss, ensureBossStarted, QUEUE_NAMES } from "./bossClient";

export interface ProcessMaterialPayload {
  materialId: string;
  projectId: string;
  filePath: string;
}

export async function enqueueProcessMaterial(payload: ProcessMaterialPayload): Promise<void> {
  const b = await ensureBossStarted();
  await b.send(QUEUE_NAMES.processMaterial, payload);
}

export async function registerProcessMaterialWorker(): Promise<void> {
  await ensureBossStarted();
  await boss.work<ProcessMaterialPayload>(QUEUE_NAMES.processMaterial, async (jobs) => {
    for (const job of jobs) {
      await runProcessMaterialJob(job as PgBoss.Job<ProcessMaterialPayload>);
    }
  });
}

async function runProcessMaterialJob(job: PgBoss.Job<ProcessMaterialPayload>): Promise<void> {
  const { materialId, projectId, filePath } = job.data;

  try {
    await repo.markProcessing(materialId);

    const fileBuffer = await downloadMaterialFile(filePath);
    const pages = await extractPdfPages(fileBuffer);
    const finalPages = await applyVisionFallback(fileBuffer, pages, { materialId, projectId });

    const chunks = chunkPages(finalPages);
    const embeddedChunks = await Promise.all(
      chunks.map(async (chunk) => ({
        ...chunk,
        embedding: await geminiProvider.embed({
          text: chunk.content,
          feature: "embedding",
          relatedEntity: { materialId, projectId },
        }),
      })),
    );
    await repo.insertChunks(materialId, projectId, embeddedChunks);

    const existingConceptNames = await repo.listConceptNamesForProject(projectId);
    const fullText = finalPages.map((p) => p.text).join("\n\n");
    const newConcepts = await extractConcepts(fullText, existingConceptNames, { materialId, projectId });
    await repo.insertConcepts(
      projectId,
      materialId,
      newConcepts.map((c) => c.name),
    );

    await repo.markReady(materialId, pages.length);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repo.markFailed(materialId, message);
    throw err; // re-throw so pg-boss applies its retry policy (decision A3/D13)
  }
}

async function applyVisionFallback(
  fileBuffer: Buffer,
  pages: ExtractedPage[],
  relatedEntity: { materialId: string; projectId: string },
): Promise<ExtractedPage[]> {
  const pagesNeedingFallback = pages.filter(needsVisionFallback);
  if (pagesNeedingFallback.length === 0) return pages;

  const rendered = await renderPagesToPngBase64(
    fileBuffer,
    pagesNeedingFallback.map((p) => p.pageNumber),
  );

  const visionTexts = new Map<number, string>();
  for (const [pageNumber, imageBase64] of rendered) {
    const text = await extractPageTextViaVision(imageBase64, `Material ${relatedEntity.materialId}, page ${pageNumber}`);
    visionTexts.set(pageNumber, text);
  }

  return pages.map((page) => {
    const visionText = visionTexts.get(page.pageNumber);
    return visionText ? { ...page, text: visionText } : page;
  });
}
