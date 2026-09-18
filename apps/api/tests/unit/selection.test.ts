import { describe, expect, it } from "vitest";
import { scoreConceptForSelection, selectDifficulty, selectNextConcept, type ConceptCandidate } from "../../src/modules/assessment/selection";

const NOW = new Date("2026-09-16T00:00:00Z");

function concept(id: string, masteryLevel: number, daysSinceEvidence: number | null): ConceptCandidate {
  return {
    conceptId: id,
    masteryLevel,
    lastEvidenceAt: daysSinceEvidence === null ? null : new Date(NOW.getTime() - daysSinceEvidence * 24 * 60 * 60 * 1000),
  };
}

describe("selectNextConcept", () => {
  it("returns undefined when there are no candidates", () => {
    expect(selectNextConcept([], [], NOW)).toBeUndefined();
  });

  it("prefers a weaker concept over a stronger one, all else equal", () => {
    const weak = concept("weak", 20, 5);
    const strong = concept("strong", 90, 5);
    expect(selectNextConcept([weak, strong], [], NOW)).toBe(weak);
  });

  it("prefers a stale concept over a recently-touched one at similar mastery", () => {
    const stale = concept("stale", 50, 30);
    const fresh = concept("fresh", 50, 0);
    expect(selectNextConcept([stale, fresh], [], NOW)).toBe(stale);
  });

  it("is not a simplistic wrong-answer ladder: a never-touched concept always outranks a recently-reinforced weak one at equal mastery", () => {
    const neverTouched = concept("never", 40, null);
    const justAnswered = concept("recent", 40, 0);
    expect(selectNextConcept([neverTouched, justAnswered], [], NOW)).toBe(neverTouched);
  });

  it("deprioritizes but does not exclude a recently-asked concept", () => {
    const onlyWeakConcept = concept("only-weak", 10, 10);
    const result = selectNextConcept([onlyWeakConcept], ["only-weak"], NOW);
    expect(result).toBe(onlyWeakConcept); // still selected — it's the only candidate

    const strongerButFreshlyAsked = concept("just-asked", 30, 10);
    const weakerNotAsked = concept("not-asked", 35, 10);
    // just-asked has lower (better) mastery than not-asked but was just asked —
    // the repeat penalty should let the marginally-weaker-but-unasked one win.
    expect(selectNextConcept([strongerButFreshlyAsked, weakerNotAsked], ["just-asked"], NOW)).toBe(weakerNotAsked);
  });

  it("scores are always non-negative and bounded", () => {
    const c = concept("x", 0, 1000);
    const score = scoreConceptForSelection(c, NOW);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("a fully-mastered concept can still resurface once stale enough, rather than scoring exactly 0 forever", () => {
    const masteredAndStale = concept("mastered", 100, 365);
    expect(scoreConceptForSelection(masteredAndStale, NOW)).toBeGreaterThan(0);

    // still ranks far below a genuinely weak concept at similar staleness —
    // resurfacing is a low-priority fallback, not a takeover.
    const weakAndStale = concept("weak", 20, 365);
    expect(selectNextConcept([masteredAndStale, weakAndStale], [], NOW)).toBe(weakAndStale);

    // and a freshly-confirmed 100%-mastery concept still correctly scores 0 —
    // only staleness should ever pull it back above 0.
    const masteredAndFresh = concept("fresh-mastered", 100, 0);
    expect(scoreConceptForSelection(masteredAndFresh, NOW)).toBe(0);
  });
});

describe("selectDifficulty", () => {
  it("maps low mastery to low difficulty and high mastery to high difficulty", () => {
    expect(selectDifficulty(0)).toBe(1);
    expect(selectDifficulty(19)).toBe(1);
    expect(selectDifficulty(20)).toBe(2);
    expect(selectDifficulty(50)).toBe(3);
    expect(selectDifficulty(79)).toBe(4);
    expect(selectDifficulty(80)).toBe(5);
    expect(selectDifficulty(100)).toBe(5);
  });

  it("clamps out-of-range mastery", () => {
    expect(selectDifficulty(-10)).toBe(1);
    expect(selectDifficulty(150)).toBe(5);
  });
});
