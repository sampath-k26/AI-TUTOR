/**
 * Golden set: recommendation relevance (docs/06-IMPLEMENTATION-PLAN.md M6).
 * Runs in the same fixture project as quizGrading.ts, after its incorrect
 * answers have driven a concept's mastery below the weak threshold — checks
 * that the generated recommendation is actually about that concept, not
 * generic filler, without a redundant LLM-judge call (see scripts/runEval.ts).
 */
export interface RecommendationRelevanceCase {
  id: string;
  /** The recommendation text must mention the weak concept's name (case-insensitive substring). */
  expectMentionsWeakConcept: boolean;
}

export const recommendationRelevanceCases: RecommendationRelevanceCase[] = [
  { id: "recommendation-mentions-weak-concept", expectMentionsWeakConcept: true },
];
