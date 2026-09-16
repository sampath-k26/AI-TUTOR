/**
 * Weighted-evidence mastery heuristic (decision D12 — deliberately not BKT/IRT,
 * see docs/02-DECISIONS-LOG.md for why). Continuous and evidence-weighted rather
 * than a wrong->easy/correct->hard ladder, per PRD §9's explicit anti-requirement.
 *
 * masteryNew = alpha * score(evidence) + (1 - alpha) * decayedOld(deltaTime)
 *
 * - alpha (learning rate) starts high with little evidence (responsive to a cold
 *   start) and shrinks as evidenceCount grows (a stable estimate resists being
 *   swung by one new data point).
 * - decayedOld pulls mastery toward a neutral midpoint the longer a concept goes
 *   untouched, so Growth Analysis can surface "requires attention" for concepts
 *   that have gone stale, not only ones that were answered incorrectly.
 * - A wrong answer (score=0) pulls mastery toward 0 proportionally to (1 - alpha) —
 *   recoverable, never a hard reset (see docs/03-ARCHITECTURE.md §5).
 */

export const MASTERY_MIDPOINT = 50;
export const DECAY_HALF_LIFE_DAYS = 30;
const MIN_ALPHA = 0.15;

export interface MasteryUpdateInput {
  masteryOld: number; // 0-100
  evidenceCount: number; // prior evidence count for this concept
  daysSinceLastEvidence: number; // 0 if this is the first evidence, or evidence is same-day
  isCorrect: boolean;
  /** open-ended grading score 0-1; for MCQ pass 1 if correct, 0 if incorrect */
  correctnessScore?: number;
  /** 1 (easiest) - 5 (hardest) */
  difficulty: number;
}

export interface MasteryUpdateResult {
  masteryNew: number; // 0-100, rounded to 2 decimals
  alpha: number;
  decayedOld: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function difficultyWeight(difficulty: number): number {
  // difficulty 1 -> 0.7x, difficulty 3 -> 1.0x, difficulty 5 -> 1.3x
  return 0.7 + 0.15 * (clamp(difficulty, 1, 5) - 1);
}

export function learningRate(evidenceCount: number): number {
  return Math.max(MIN_ALPHA, 1 / (1 + evidenceCount));
}

export function decayTowardMidpoint(masteryOld: number, daysSinceLastEvidence: number): number {
  const decayFactor = Math.exp((-Math.LN2 * Math.max(0, daysSinceLastEvidence)) / DECAY_HALF_LIFE_DAYS);
  return MASTERY_MIDPOINT + (masteryOld - MASTERY_MIDPOINT) * decayFactor;
}

export function updateMastery(input: MasteryUpdateInput): MasteryUpdateResult {
  const baseCorrectness = input.correctnessScore ?? (input.isCorrect ? 1 : 0);
  const score = baseCorrectness * difficultyWeight(input.difficulty) * 100;

  const alpha = learningRate(input.evidenceCount);
  const decayedOld = decayTowardMidpoint(input.masteryOld, input.daysSinceLastEvidence);

  const masteryNew = clamp(alpha * score + (1 - alpha) * decayedOld, 0, 100);

  return { masteryNew: Math.round(masteryNew * 100) / 100, alpha, decayedOld };
}
