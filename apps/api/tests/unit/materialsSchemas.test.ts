import { describe, expect, it } from "vitest";
import { hasPdfMagicBytes } from "../../src/modules/materials/schemas";

describe("hasPdfMagicBytes", () => {
  it("accepts a buffer starting with the real PDF magic number", () => {
    expect(hasPdfMagicBytes(Buffer.from("%PDF-1.7\n%âãÏÓ\n..."))).toBe(true);
  });

  it("rejects plain text with a spoofed Content-Type", () => {
    expect(hasPdfMagicBytes(Buffer.from("not a pdf"))).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(hasPdfMagicBytes(Buffer.alloc(0))).toBe(false);
  });

  it("rejects a buffer that merely contains the magic bytes later, not at the start", () => {
    expect(hasPdfMagicBytes(Buffer.from("garbage before %PDF-1.7"))).toBe(false);
  });
});
