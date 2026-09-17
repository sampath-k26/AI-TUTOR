import { describe, expect, it } from "vitest";
import { parseVisionBatchResponse } from "../../src/modules/materials/processing/visionFallback";

describe("parseVisionBatchResponse", () => {
  it("splits a well-formed multi-page response into per-page text", () => {
    const raw = ["===PAGE 1===", "First page text.", "===PAGE 2===", "Second page text."].join("\n");
    const result = parseVisionBatchResponse(raw);

    expect(result.size).toBe(2);
    expect(result.get(1)).toBe("First page text.");
    expect(result.get(2)).toBe("Second page text.");
  });

  it("tolerates minor spacing variance around the delimiter", () => {
    const raw = "=== PAGE 3 ===\nSome text.";
    const result = parseVisionBatchResponse(raw);
    expect(result.get(3)).toBe("Some text.");
  });

  it("omits a page whose delimiter is missing, rather than mapping it to empty text", () => {
    // Only page 2's delimiter appears — page 1's text (if any) precedes the first
    // delimiter and must not be attributed to any page.
    const raw = ["Some preamble the model shouldn't have written.", "===PAGE 2===", "Second page text."].join("\n");
    const result = parseVisionBatchResponse(raw);

    expect(result.has(1)).toBe(false);
    expect(result.get(2)).toBe("Second page text.");
  });

  it("returns an empty map for a response with no delimiters at all", () => {
    const result = parseVisionBatchResponse("The model ignored the instructions entirely.");
    expect(result.size).toBe(0);
  });
});
