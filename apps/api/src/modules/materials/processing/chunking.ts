import type { ExtractedPage } from "./extract";

export interface Chunk {
  pageNumber: number;
  content: string;
}

/**
 * Page-aware chunking (decision D10): every chunk carries exactly one page number,
 * set at chunk-creation time rather than inferred later, so citations ("Source:
 * <Material> — Page N") are always accurate. Chunks never span a page boundary —
 * a modest cost in cross-page context, traded for citation reliability, which
 * PRD §7 treats as a core evaluation requirement.
 */
export interface ChunkingOptions {
  targetChars: number;
  overlapRatio: number; // 0-1
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  targetChars: 1000,
  overlapRatio: 0.12,
};

// How far back from a hard cutoff to look for a sentence-ending boundary before
// giving up and cutting mid-sentence anyway. Scoped to sentences only (not
// paragraphs) since the whitespace-collapse below already destroys paragraph
// breaks before this point.
const BOUNDARY_LOOKBACK_CHARS = 200;
const SENTENCE_BOUNDARY = /[.?!](?=\s)/g;

/** Prefers cutting at the last sentence boundary within the lookback window
 * before `hardEnd`; falls back to `hardEnd` itself (today's exact behavior)
 * when none is found, or when `hardEnd` already reaches the end of the text. */
function findCutPoint(text: string, start: number, hardEnd: number): number {
  if (hardEnd >= text.length) return hardEnd;

  const windowStart = Math.max(start, hardEnd - BOUNDARY_LOOKBACK_CHARS);
  const window = text.slice(windowStart, hardEnd);

  let lastBoundaryEnd = -1;
  for (const match of window.matchAll(SENTENCE_BOUNDARY)) {
    lastBoundaryEnd = match.index + match[0].length;
  }

  return lastBoundaryEnd === -1 ? hardEnd : windowStart + lastBoundaryEnd;
}

export function chunkPage(page: ExtractedPage, options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS): Chunk[] {
  const text = page.text.trim().replace(/\s+/g, " ");
  if (text.length === 0) return [];

  if (text.length <= options.targetChars) {
    return [{ pageNumber: page.pageNumber, content: text }];
  }

  const step = Math.max(1, Math.round(options.targetChars * (1 - options.overlapRatio)));
  const overlapChars = options.targetChars - step;
  const chunks: Chunk[] = [];

  for (let start = 0; start < text.length; ) {
    const hardEnd = Math.min(start + options.targetChars, text.length);
    const end = findCutPoint(text, start, hardEnd);
    chunks.push({ pageNumber: page.pageNumber, content: text.slice(start, end) });
    if (end === text.length) break;
    // Falls back to exactly `start + step` when no boundary was found — same
    // fixed-step advance as before this change.
    start = Math.max(start + 1, end - overlapChars);
  }

  return chunks;
}

export function chunkPages(pages: ExtractedPage[], options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS): Chunk[] {
  return pages.flatMap((page) => chunkPage(page, options));
}
