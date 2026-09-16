import { describe, expect, it } from "vitest";
import { detectRepeatedMistakeConcepts } from "../../src/modules/assessment/mistakePattern";

describe("detectRepeatedMistakeConcepts", () => {
  it("returns nothing when there are no incorrect responses", () => {
    const result = detectRepeatedMistakeConcepts([
      { conceptId: "a", isCorrect: true },
      { conceptId: "b", isCorrect: true },
    ]);
    expect(result).toEqual([]);
  });

  it("does not flag a single incorrect response", () => {
    const result = detectRepeatedMistakeConcepts([
      { conceptId: "a", isCorrect: false },
      { conceptId: "a", isCorrect: true },
    ]);
    expect(result).toEqual([]);
  });

  it("flags a concept with 2+ incorrect responses", () => {
    const result = detectRepeatedMistakeConcepts([
      { conceptId: "a", isCorrect: false },
      { conceptId: "a", isCorrect: false },
    ]);
    expect(result).toEqual(["a"]);
  });

  it("ranks the most-repeated mistake first", () => {
    const result = detectRepeatedMistakeConcepts([
      { conceptId: "a", isCorrect: false },
      { conceptId: "a", isCorrect: false },
      { conceptId: "b", isCorrect: false },
      { conceptId: "b", isCorrect: false },
      { conceptId: "b", isCorrect: false },
    ]);
    expect(result).toEqual(["b", "a"]);
  });

  it("treats null (open-ended, not yet scored as boolean) as not incorrect", () => {
    const result = detectRepeatedMistakeConcepts([
      { conceptId: "a", isCorrect: null },
      { conceptId: "a", isCorrect: null },
    ]);
    expect(result).toEqual([]);
  });

  it("ignores unrelated concepts mixed into the history", () => {
    const result = detectRepeatedMistakeConcepts([
      { conceptId: "a", isCorrect: false },
      { conceptId: "a", isCorrect: false },
      { conceptId: "c", isCorrect: true },
      { conceptId: "d", isCorrect: false },
    ]);
    expect(result).toEqual(["a"]);
  });
});
