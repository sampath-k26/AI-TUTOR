import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfPages, needsVisionFallback, MIN_EXTRACTED_CHARS_PER_PAGE } from "../../src/modules/materials/processing/extract";

// tests/fixtures/sample.pdf is a minimal hand-built single-page PDF ("Hello World"
// via a raw content stream, not embedded as an image) — enough to exercise the
// real pdfjs-dist Node code path without needing a full real-world document.
const fixturePath = path.join(import.meta.dirname, "..", "fixtures", "sample.pdf");

describe("extractPdfPages", () => {
  it("extracts real text content and a page number from a real PDF", async () => {
    const buf = readFileSync(fixturePath);
    const pages = await extractPdfPages(buf);

    expect(pages).toHaveLength(1);
    expect(pages[0]?.pageNumber).toBe(1);
    expect(pages[0]?.text).toContain("Hello World");
  });
});

describe("needsVisionFallback", () => {
  it("flags a page with too little extracted text", () => {
    expect(needsVisionFallback({ pageNumber: 1, text: "short", textDensity: 0 })).toBe(true);
  });

  it("does not flag a page with plenty of extracted text", () => {
    const text = "a".repeat(MIN_EXTRACTED_CHARS_PER_PAGE + 10);
    expect(needsVisionFallback({ pageNumber: 1, text, textDensity: 0 })).toBe(false);
  });

  it("flags a page with no extracted text at all (a truly scanned page)", () => {
    expect(needsVisionFallback({ pageNumber: 1, text: "", textDensity: 0 })).toBe(true);
  });
});
