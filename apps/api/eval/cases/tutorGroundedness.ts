/**
 * Golden set: Tutor groundedness + unsupported-question handling
 * (docs/06-IMPLEMENTATION-PLAN.md M6). Run against a project seeded with
 * gradient-descent material — see scripts/runEval.ts.
 */
export interface TutorGroundednessCase {
  id: string;
  question: string;
  expectInsufficientEvidence: boolean;
  /** Only checked when expectInsufficientEvidence is false. */
  expectAtLeastOneCitation?: boolean;
}

export const tutorGroundednessCases: TutorGroundednessCase[] = [
  {
    id: "grounded-gradient-descent",
    question: "What is gradient descent and how does the learning rate affect it?",
    expectInsufficientEvidence: false,
    expectAtLeastOneCitation: true,
  },
  {
    id: "unsupported-off-topic",
    question: "What is the capital of France?",
    expectInsufficientEvidence: true,
  },
];
