import { describe, expect, it } from "vitest";
import {
  DECAY_HALF_LIFE_DAYS,
  MASTERY_MIDPOINT,
  decayTowardMidpoint,
  difficultyWeight,
  learningRate,
  updateMastery,
} from "../../src/modules/assessment/mastery";

describe("difficultyWeight", () => {
  it("weights harder questions more heavily than easier ones", () => {
    expect(difficultyWeight(5)).toBeGreaterThan(difficultyWeight(3));
    expect(difficultyWeight(3)).toBeGreaterThan(difficultyWeight(1));
  });

  it("clamps out-of-range difficulty into [1,5]", () => {
    expect(difficultyWeight(10)).toBe(difficultyWeight(5));
    expect(difficultyWeight(-5)).toBe(difficultyWeight(1));
  });
});

describe("learningRate", () => {
  it("starts near 1 for a brand-new concept (cold start)", () => {
    expect(learningRate(0)).toBe(1);
  });

  it("decreases as evidence accumulates, floored at MIN_ALPHA", () => {
    const early = learningRate(1);
    const later = learningRate(20);
    expect(later).toBeLessThan(early);
    expect(later).toBeGreaterThanOrEqual(0.15);
  });
});

describe("decayTowardMidpoint", () => {
  it("returns the same value with zero elapsed time", () => {
    expect(decayTowardMidpoint(80, 0)).toBeCloseTo(80, 5);
  });

  it("pulls a high mastery value down toward the midpoint over time", () => {
    const decayed = decayTowardMidpoint(90, DECAY_HALF_LIFE_DAYS);
    expect(decayed).toBeLessThan(90);
    expect(decayed).toBeGreaterThan(MASTERY_MIDPOINT);
  });

  it("pulls a low mastery value up toward the midpoint over time", () => {
    const decayed = decayTowardMidpoint(10, DECAY_HALF_LIFE_DAYS);
    expect(decayed).toBeGreaterThan(10);
    expect(decayed).toBeLessThan(MASTERY_MIDPOINT);
  });

  it("approaches the midpoint asymptotically over a long time", () => {
    const decayed = decayTowardMidpoint(100, DECAY_HALF_LIFE_DAYS * 20);
    expect(decayed).toBeCloseTo(MASTERY_MIDPOINT, 0);
  });
});

describe("updateMastery", () => {
  it("moves mastery substantially on the very first correct answer (cold start)", () => {
    const result = updateMastery({
      masteryOld: 0,
      evidenceCount: 0,
      daysSinceLastEvidence: 0,
      isCorrect: true,
      difficulty: 3,
    });
    expect(result.masteryNew).toBeGreaterThan(50);
  });

  it("is not a simplistic wrong->easy/correct->hard ladder: a single wrong answer does not zero out established mastery", () => {
    const result = updateMastery({
      masteryOld: 85,
      evidenceCount: 10,
      daysSinceLastEvidence: 1,
      isCorrect: false,
      difficulty: 3,
    });
    expect(result.masteryNew).toBeGreaterThan(0);
    expect(result.masteryNew).toBeLessThan(85);
  });

  it("rewards a correct answer on a harder question more than an equally correct easier one", () => {
    const base = { masteryOld: 50, evidenceCount: 5, daysSinceLastEvidence: 1, isCorrect: true };
    const easy = updateMastery({ ...base, difficulty: 1 });
    const hard = updateMastery({ ...base, difficulty: 5 });
    expect(hard.masteryNew).toBeGreaterThan(easy.masteryNew);
  });

  it("keeps repeated correct answers converging toward 100 without exceeding it", () => {
    let mastery = 0;
    let evidenceCount = 0;
    for (let i = 0; i < 15; i++) {
      const result = updateMastery({
        masteryOld: mastery,
        evidenceCount,
        daysSinceLastEvidence: 1,
        isCorrect: true,
        difficulty: 4,
      });
      mastery = result.masteryNew;
      evidenceCount++;
    }
    expect(mastery).toBeLessThanOrEqual(100);
    expect(mastery).toBeGreaterThan(80);
  });

  it("never goes below 0 or above 100", () => {
    const low = updateMastery({ masteryOld: 2, evidenceCount: 0, daysSinceLastEvidence: 0, isCorrect: false, difficulty: 5 });
    const high = updateMastery({ masteryOld: 99, evidenceCount: 0, daysSinceLastEvidence: 0, isCorrect: true, difficulty: 5 });
    expect(low.masteryNew).toBeGreaterThanOrEqual(0);
    expect(high.masteryNew).toBeLessThanOrEqual(100);
  });

  it("caps the per-evidence score at the maximum signal instead of letting a high-difficulty weight push a partial answer past what a fully-correct answer would produce", () => {
    // difficultyWeight(5) = 1.3x, so an uncapped score is 0.9*1.3*100=117 for a
    // 90%-correct answer and 130 for a fully-correct one — both above the
    // intended 100 ceiling. Capped, they collapse to the same 100 and must
    // therefore blend into identical mastery, not different mid-90s/low-100s values.
    const base = { masteryOld: 50, evidenceCount: 5, daysSinceLastEvidence: 1, isCorrect: true, difficulty: 5 };
    const mostlyCorrect = updateMastery({ ...base, correctnessScore: 0.9 });
    const fullyCorrect = updateMastery({ ...base, correctnessScore: 1 });
    expect(mostlyCorrect.masteryNew).toBe(fullyCorrect.masteryNew);
  });

  it("supports fractional open-ended grading scores instead of only boolean correctness", () => {
    const partial = updateMastery({
      masteryOld: 50,
      evidenceCount: 5,
      daysSinceLastEvidence: 1,
      isCorrect: true,
      correctnessScore: 0.5,
      difficulty: 3,
    });
    const full = updateMastery({
      masteryOld: 50,
      evidenceCount: 5,
      daysSinceLastEvidence: 1,
      isCorrect: true,
      correctnessScore: 1,
      difficulty: 3,
    });
    expect(partial.masteryNew).toBeLessThan(full.masteryNew);
  });
});
