/**
 * Adaptive concept/difficulty selection (PRD §9's explicit anti-requirement: not a
 * simplistic wrong->easy/correct->hard ladder). Ranks concepts by how weak AND how
 * stale the evidence is, not by the single last answer — see docs/03-ARCHITECTURE.md §5.
 */

export interface ConceptCandidate {
  conceptId: string;
  masteryLevel: number; // 0-100
  lastEvidenceAt: Date | null;
}

const RECENCY_CAP_DAYS = 14;
const REPEAT_PENALTY = 0.5;

export function scoreConceptForSelection(
  concept: ConceptCandidate,
  now: Date,
  recentlyAskedConceptIds: string[] = [],
): number {
  const lowMasteryWeight = (100 - clamp(concept.masteryLevel, 0, 100)) / 100;

  const daysSinceEvidence = concept.lastEvidenceAt
    ? (now.getTime() - concept.lastEvidenceAt.getTime()) / (1000 * 60 * 60 * 24)
    : Number.POSITIVE_INFINITY;
  const recencyWeight = Math.min(1, daysSinceEvidence / RECENCY_CAP_DAYS);

  let score = lowMasteryWeight * (0.5 + 0.5 * recencyWeight);

  if (recentlyAskedConceptIds.includes(concept.conceptId)) {
    // Deprioritized, not excluded — a concept can still repeat if it's genuinely
    // the only weak one, but variety is preferred when candidates are close.
    score *= REPEAT_PENALTY;
  }

  return score;
}

/** Returns undefined only when there are no candidates at all. */
export function selectNextConcept(
  candidates: ConceptCandidate[],
  recentlyAskedConceptIds: string[] = [],
  now: Date = new Date(),
): ConceptCandidate | undefined {
  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, candidate) =>
    scoreConceptForSelection(candidate, now, recentlyAskedConceptIds) >
    scoreConceptForSelection(best, now, recentlyAskedConceptIds)
      ? candidate
      : best,
  );
}

/**
 * Difficulty (1-5) is matched to the concept's current mastery band, not derived
 * from the single last answer (PRD §9).
 */
export function selectDifficulty(masteryLevel: number): number {
  const level = clamp(masteryLevel, 0, 100);
  if (level < 20) return 1;
  if (level < 40) return 2;
  if (level < 60) return 3;
  if (level < 80) return 4;
  return 5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
