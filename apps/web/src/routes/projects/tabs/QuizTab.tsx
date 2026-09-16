import { useState } from "react";
import { ApiError } from "../../../lib/apiClient";
import { apiClient } from "../../../lib/apiClient";
import type { AnswerResult, McqEvaluation, OpenEndedEvaluation, Question, Quiz } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";

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
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {state === "idle" && (
        <Button onClick={handleStart} disabled={busy} className="self-start">
          {busy ? "Starting…" : "Start Quiz"}
        </Button>
      )}

      {state === "no-concepts" && <p className="text-[13.5px] text-muted-foreground">No concepts available yet — upload and process material first.</p>}

      {state === "completed" && <p className="text-[13.5px] text-foreground">Quiz completed. Nice work.</p>}

      {state === "in-progress" && question && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-[18px]">
            <div>
              <Badge variant="secondary">Difficulty {question.difficulty}/5</Badge>
              <p className="mt-2 text-[14px] text-foreground">{question.prompt}</p>
            </div>

            {!result &&
              (question.type === "mcq" ? (
                <div className="flex flex-col gap-2">
                  {question.options?.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 text-[13.5px] text-foreground">
                      <input type="radio" name="mcq" value={i} checked={answer === String(i)} onChange={() => setAnswer(String(i))} />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" />
              ))}

            {!result && (
              <Button onClick={handleSubmitAnswer} disabled={busy || !answer} className="self-start">
                {busy ? "Submitting…" : "Submit Answer"}
              </Button>
            )}

            {result && (
              <div className="flex flex-col gap-2 border-t border-border pt-4 text-[13.5px]">
                {isMcqEvaluation(result.evaluation) ? (
                  <p className={result.evaluation.isCorrect ? "text-success" : "text-destructive"}>
                    {result.evaluation.isCorrect ? "Correct." : `Incorrect — the correct option was #${result.evaluation.correctIndex + 1}.`}
                  </p>
                ) : (
                  <>
                    <p className="text-foreground">Understanding: {result.evaluation.understanding}</p>
                    <p className="text-foreground">{result.evaluation.feedbackText}</p>
                    {result.evaluation.missingConcepts.length > 0 && (
                      <p className="text-muted-foreground">Missing: {result.evaluation.missingConcepts.join(", ")}</p>
                    )}
                  </>
                )}
                <p className="text-muted-foreground">
                  Mastery now {result.masteryLevel.toFixed(0)}% ({result.trend.replace("_", " ")})
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleNext} disabled={busy} variant="secondary" size="sm">
                    Next Question
                  </Button>
                  <Button onClick={handleFinish} disabled={busy} variant="outline" size="sm">
                    Finish Quiz
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
