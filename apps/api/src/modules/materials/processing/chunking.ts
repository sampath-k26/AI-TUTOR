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

export function chunkPage(page: ExtractedPage, options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS): Chunk[] {
  const text = page.text.trim().replace(/\s+/g, " ");
  if (text.length === 0) return [];

  if (text.length <= options.targetChars) {
    return [{ pageNumber: page.pageNumber, content: text }];
  }

  const step = Math.max(1, Math.round(options.targetChars * (1 - options.overlapRatio)));
  const chunks: Chunk[] = [];

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + options.targetChars, text.length);
    chunks.push({ pageNumber: page.pageNumber, content: text.slice(start, end) });
    if (end === text.length) break;
  }

  return chunks;
}

export function chunkPages(pages: ExtractedPage[], options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS): Chunk[] {
  return pages.flatMap((page) => chunkPage(page, options));
}
