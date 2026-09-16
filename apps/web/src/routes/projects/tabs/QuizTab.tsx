import { useState } from "react";
import { ApiError } from "../../../lib/apiClient";
import { apiClient } from "../../../lib/apiClient";
import type { AnswerResult, McqEvaluation, OpenEndedEvaluation, Question, Quiz } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";

type QuizState = "idle" | "no-concepts" | "in-progress" | "completed";

function isMcqEvaluation(evaluation: OpenEndedEvaluation | McqEvaluation): evaluation is McqEvaluation {
  return "correctIndex" in evaluation;
}

export function QuizTab() {
  const project = useProjectContext();
  const [state, setState] = useState<QuizState>("idle");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchNextQuestion(quizId: string) {
    try {
      const res = await apiClient.post<{ question?: Question; noConceptsAvailable?: true }>(
        `/projects/${project.id}/quizzes/${quizId}/next-question`,
      );
      if (res.noConceptsAvailable) {
        setState("no-concepts");
        return;
      }
      setQuestion(res.question ?? null);
      setResult(null);
      setAnswer("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setState("no-concepts");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load the next question");
    }
  }

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const res = await apiClient.post<{ quiz: Quiz }>(`/projects/${project.id}/quizzes`);
      setQuiz(res.quiz);
      setState("in-progress");
      await fetchNextQuestion(res.quiz.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the quiz");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!question || !answer) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiClient.post<AnswerResult>(`/projects/${project.id}/questions/${question.id}/answer`, { answer });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit your answer");
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    if (!quiz) return;
    setBusy(true);
    await fetchNextQuestion(quiz.id);
    setBusy(false);
  }

  async function handleFinish() {
    if (!quiz) return;
    setBusy(true);
    try {
      await apiClient.post(`/projects/${project.id}/quizzes/${quiz.id}/finish`);
      setState("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish the quiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quiz-tab">
      <h2>Quiz</h2>
      {error && <p role="alert">{error}</p>}

      {state === "idle" && (
        <button onClick={handleStart} disabled={busy}>
          {busy ? "Starting…" : "Start Quiz"}
        </button>
      )}

      {state === "no-concepts" && <p>No concepts available yet — upload and process material first.</p>}

      {state === "completed" && <p>Quiz completed. Nice work.</p>}

      {state === "in-progress" && question && (
        <div className="quiz-question">
          <p>
            <em>Difficulty {question.difficulty}/5</em>
          </p>
          <p>{question.prompt}</p>

          {!result &&
            (question.type === "mcq" ? (
              <div className="quiz-options">
                {question.options?.map((opt, i) => (
                  <label key={i}>
                    <input type="radio" name="mcq" value={i} checked={answer === String(i)} onChange={() => setAnswer(String(i))} />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" />
            ))}

          {!result && (
            <button onClick={handleSubmitAnswer} disabled={busy || !answer}>
              {busy ? "Submitting…" : "Submit Answer"}
            </button>
          )}

          {result && (
            <div className="quiz-feedback">
              {isMcqEvaluation(result.evaluation) ? (
                <p>{result.evaluation.isCorrect ? "Correct." : `Incorrect — the correct option was #${result.evaluation.correctIndex + 1}.`}</p>
              ) : (
                <>
                  <p>Understanding: {result.evaluation.understanding}</p>
                  <p>{result.evaluation.feedbackText}</p>
                  {result.evaluation.missingConcepts.length > 0 && <p>Missing: {result.evaluation.missingConcepts.join(", ")}</p>}
                </>
              )}
              <p>
                Mastery now {result.masteryLevel.toFixed(0)}% ({result.trend.replace("_", " ")})
              </p>
              <button onClick={handleNext} disabled={busy}>
                Next Question
              </button>
              <button onClick={handleFinish} disabled={busy}>
                Finish Quiz
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
