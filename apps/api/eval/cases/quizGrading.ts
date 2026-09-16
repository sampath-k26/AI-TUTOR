/**
 * Golden set: quiz grading (docs/06-IMPLEMENTATION-PLAN.md M6). Exercises the
 * real generateNextQuestion/submitAnswer pipeline rather than fixture
 * questions (per module-boundary rules, the eval script — outside the
 * assessment module — only calls its service layer, same as any other
 * caller), so each case waits for a question of the given type to come up
 * and then answers it according to the strategy.
 */
export type AnswerStrategy = "correct" | "incorrect" | "weak_off_topic";

export interface QuizGradingCase {
  id: string;
  questionType: "mcq" | "open_ended";
  answerStrategy: AnswerStrategy;
  /** Expected isCorrect for mcq cases; expected non-"strong" understanding for open_ended weak-answer cases. */
  expectation: "correct" | "incorrect" | "not_strong";
}

export const quizGradingCases: QuizGradingCase[] = [
  { id: "mcq-correct-answer-graded-correct", questionType: "mcq", answerStrategy: "correct", expectation: "correct" },
  { id: "mcq-incorrect-answer-graded-incorrect", questionType: "mcq", answerStrategy: "incorrect", expectation: "incorrect" },
  { id: "open-ended-weak-answer-graded-not-strong", questionType: "open_ended", answerStrategy: "weak_off_topic", expectation: "not_strong" },
];
