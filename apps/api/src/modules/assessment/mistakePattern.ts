/**
 * Repeated-mistake detection (PRD §11's third named workflow: "Repeated Mistake
 * -> Identify Pattern -> Update Learning Context -> Generate Targeted
 * Recommendation"). Pure function over recent responses so it's testable without
 * a database.
 */

export interface ResponseRecord {
  conceptId: string;
  isCorrect: boolean | null;
}

const MIN_INCORRECT_TO_FLAG = 2;

/** Concepts with 2+ incorrect responses in the recent window, ranked most-repeated first. */
export function detectRepeatedMistakeConcepts(recentResponses: ResponseRecord[]): string[] {
  const incorrectCounts = new Map<string, number>();

  for (const response of recentResponses) {
    if (response.isCorrect === false) {
      incorrectCounts.set(response.conceptId, (incorrectCounts.get(response.conceptId) ?? 0) + 1);
    }
  }

  return [...incorrectCounts.entries()]
    .filter(([, count]) => count >= MIN_INCORRECT_TO_FLAG)
    .sort((a, b) => b[1] - a[1])
    .map(([conceptId]) => conceptId);
}
