import { createCanvas } from "@napi-rs/canvas";
import { getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { geminiProvider } from "../../../aiProvider";

/**
 * Renders a PDF page to a PNG so it can be sent to Gemini's vision-based document
 * understanding as a fallback for scanned/image-heavy pages (see extract.ts's
 * needsVisionFallback and docs/03-ARCHITECTURE.md §3).
 *
 * @napi-rs/canvas's Canvas is runtime-compatible with pdfjs-dist's expected
 * HTMLCanvasElement (this is pdfjs-dist's own documented Node rendering path —
 * it requires @napi-rs/canvas itself when running server-side) but is not
 * nominally typed as one, hence the cast.
 */
export async function renderPageToPngBase64(page: PDFPageProxy, scale = 2): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  // pdfjs-dist's types assume a DOM lib (HTMLCanvasElement/CanvasRenderingContext2D)
  // that this Node backend intentionally doesn't include (see tsconfig.base.json) —
  // @napi-rs/canvas is pdfjs-dist's own documented Node rendering path, so this is a
  // real, deliberate cross-library type gap, not a shortcut around one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvas: canvas as any, canvasContext: context as any, viewport }).promise;

  return canvas.toBuffer("image/png").toString("base64");
}

/**
 * Re-opens the document to render only the specific pages that need the vision
 * fallback (typically a small minority of pages) — kept separate from extract.ts's
 * fast text pass so each module has a single responsibility (see decision D4).
 */
export async function renderPagesToPngBase64(fileBuffer: Buffer, pageNumbers: number[]): Promise<Map<number, string>> {
  const pdf = await getDocument({ data: new Uint8Array(fileBuffer) }).promise;
  const result = new Map<number, string>();

  for (const pageNumber of pageNumbers) {
    const page = await pdf.getPage(pageNumber);
    result.set(pageNumber, await renderPageToPngBase64(page));
  }

  await pdf.destroy();
  return result;
}

export async function extractPageTextViaVision(imageBase64: string, projectContext: string): Promise<string> {
  return geminiProvider.understandDocument({
    imageBase64,
    mimeType: "image/png",
    prompt:
      "Extract all readable text from this document page as plain text, preserving structure " +
      "such as headings, lists, and tables (represent tables as simple readable rows) where " +
      `possible. Return only the extracted text, no commentary. Context: ${projectContext}`,
    feature: "document_understanding",
  });
}
