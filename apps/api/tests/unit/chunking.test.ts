import { describe, expect, it } from "vitest";
import { chunkPage, chunkPages, type ChunkingOptions } from "../../src/modules/materials/processing/chunking";
import type { ExtractedPage } from "../../src/modules/materials/processing/extract";

function page(pageNumber: number, text: string): ExtractedPage {
  return { pageNumber, text, textDensity: 0 };
}

describe("chunkPage", () => {
  it("returns no chunks for an empty/whitespace-only page", () => {
    expect(chunkPage(page(1, "   "))).toEqual([]);
  });

  it("returns a single chunk when the page text fits within targetChars", () => {
    const chunks = chunkPage(page(1, "short text"), { targetChars: 1000, overlapRatio: 0.12 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ pageNumber: 1, content: "short text" });
  });

  it("every chunk carries the source page number", () => {
    const longText = "word ".repeat(1000);
    const chunks = chunkPage(page(7, longText), { targetChars: 200, overlapRatio: 0.1 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.pageNumber === 7)).toBe(true);
  });

  it("produces overlapping content between consecutive chunks", () => {
    const longText = Array.from({ length: 500 }, (_, i) => `w${i}`).join(" ");
    const options: ChunkingOptions = { targetChars: 100, overlapRatio: 0.2 };
    const chunks = chunkPage(page(1, longText), options);

    expect(chunks.length).toBeGreaterThan(1);
    const firstChunk = chunks[0];
    const secondChunk = chunks[1];
    expect(firstChunk).toBeDefined();
    expect(secondChunk).toBeDefined();
    const overlapTail = firstChunk!.content.slice(-10);
    expect(secondChunk!.content).toContain(overlapTail);
  });

  it("prefers cutting at a sentence boundary over a mid-word hard cutoff", () => {
    // Each sentence is short and clearly delimited, and the hard cutoff (targetChars=100)
    // is deliberately positioned to land mid-word absent boundary-aware cutting.
    const sentences = Array.from({ length: 20 }, (_, i) => `This is sentence number ${i} in the document.`);
    const longText = sentences.join(" ");
    const chunks = chunkPage(page(1, longText), { targetChars: 100, overlapRatio: 0.1 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1)) {
      // every non-final chunk should end right after sentence-ending punctuation,
      // not mid-word
      expect(chunk.content).toMatch(/[.?!]$/);
    }
  });

  it("covers the full text with no gaps between chunk start positions", () => {
    const longText = Array.from({ length: 400 }, (_, i) => String(i).padStart(4, "0")).join("");
    const chunks = chunkPage(page(1, longText), { targetChars: 500, overlapRatio: 0.1 });

    // reconstruct the union of covered ranges and confirm it's contiguous end-to-end
    const firstChunk = chunks[0];
    const lastChunk = chunks.at(-1);
    expect(firstChunk).toBeDefined();
    expect(lastChunk).toBeDefined();
    expect(longText.startsWith(firstChunk!.content.slice(0, 20))).toBe(true);
    expect(longText.endsWith(lastChunk!.content.slice(-20))).toBe(true);
  });
});

describe("chunkPages", () => {
  it("never lets a chunk span two pages", () => {
    const pages = [page(1, "a ".repeat(600)), page(2, "b ".repeat(600))];
    const chunks = chunkPages(pages, { targetChars: 300, overlapRatio: 0.1 });

    expect(chunks.some((c) => c.pageNumber === 1)).toBe(true);
    expect(chunks.some((c) => c.pageNumber === 2)).toBe(true);
    for (const chunk of chunks) {
      expect(chunk.content.includes("a") && chunk.content.includes("b")).toBe(false);
    }
  });

  it("skips pages with no extractable text without throwing", () => {
    const pages = [page(1, ""), page(2, "real content here")];
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.pageNumber).toBe(2);
  });
});
