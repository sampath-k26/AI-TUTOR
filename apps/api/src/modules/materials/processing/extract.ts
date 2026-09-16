import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// pdfjs-dist needs to be told where its bundled standard-font/CMap data lives
// when running outside a bundler (plain Node) — otherwise it works but warns
// and falls back to approximate glyph metrics for non-embedded standard fonts.
// Its Node fetch implementation does a plain fs.readFile(url), so these must be
// filesystem paths (verified against the installed package), not file:// URL strings.
const pdfjsDistRoot = fileURLToPath(new URL("./", import.meta.resolve("pdfjs-dist/package.json")));
const standardFontDataUrl = `${pdfjsDistRoot}standard_fonts/`;
const cMapUrl = `${pdfjsDistRoot}cmaps/`;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  /** characters of extracted text per rendered point of page area — kept for observability/diagnostics, not the primary fallback signal (see needsVisionFallback) */
  textDensity: number;
}

/**
 * A scanned page with no embedded text layer extracts to ~0 characters regardless
 * of page size, so an absolute character-count floor is a more robust signal than
 * a page-area-normalized density — verified against a real (if minimal) PDF via
 * pdfjs-dist during development: a short-but-real text page has a very low
 * area-normalized density too, which would have produced false positives.
 * This threshold is a starting heuristic to calibrate further against real
 * study material once available (see docs/06-IMPLEMENTATION-PLAN.md known
 * simplifications).
 */
export const MIN_EXTRACTED_CHARS_PER_PAGE = 40;

export async function extractPdfPages(fileBuffer: Buffer): Promise<ExtractedPage[]> {
  const loadingTask = getDocument({
    data: new Uint8Array(fileBuffer),
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;

  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");

    const viewport = page.getViewport({ scale: 1 });
    const area = viewport.width * viewport.height;
    const textDensity = area > 0 ? text.length / area : 0;

    pages.push({ pageNumber, text, textDensity });
  }

  await pdf.destroy();
  return pages;
}

export function needsVisionFallback(page: ExtractedPage): boolean {
  return page.text.trim().length < MIN_EXTRACTED_CHARS_PER_PAGE;
}
