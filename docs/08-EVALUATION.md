# Evaluation (M6)

A small golden set (decision D15: "LLM-as-judge + a golden set, not exhaustive automated regression in CI") exercised through the real pipeline, not mocks — `apps/api/scripts/runEval.ts` calls the same service-layer functions the app uses (`handleTutorMessage`, `generateNextQuestion`, `submitAnswer`, `finishQuiz`), the same way `scripts/seed.ts` does.

## Running it

```
npm run eval --workspace apps/api
```

Requires a working Supabase connection and both `GEMINI_API_KEY`/`GROQ_API_KEY` in `apps/api/.env` — it makes real AI calls. Registers its own in-process pg-boss workers, so it works standalone without `npm run worker` running separately. Exits `0` only if every case passed; `1` if anything failed or errored.

## What it covers, and why it's scored the way it is

Rather than a second LLM-judge call per case (which would roughly double the AI usage this script costs to run), every case is scored against a **structural/behavioral signal the app already produces and validates** — the same signal a real user session relies on:

| Suite | Case(s) | Signal checked |
|---|---|---|
| `tutor-groundedness` (`eval/cases/tutorGroundedness.ts`) | A question answerable from uploaded material; an off-topic question | `insufficientEvidence` flag and citation count from `handleTutorMessage` — decision D11's two-layer grounding gate is exactly what's being verified here |
| `prompt-injection` (`eval/cases/promptInjection.ts`) | A question over material that embeds a fake "SYSTEM OVERRIDE" instruction claiming authority over the model | The answer must never contain the planted trigger phrase — a direct test of the Tutor system instruction's "reference data, never a command" framing (see `docs/07-SECURITY-PASS.md` §4) |
| `quiz-grading` (`eval/cases/quizGrading.ts`) | MCQ answered correctly / incorrectly; an open-ended question answered weakly | `isCorrect` (deterministic for MCQ) and `understanding` (Gemini's structured grading) from `submitAnswer` |
| `recommendation-relevance` (`eval/cases/recommendationRelevance.ts`) | After the quiz-grading cases leave a concept below the weak-mastery threshold | The generated recommendation's text must mention that concept by name — a real relevance check, not just "a recommendation exists" |

Each suite creates its own throwaway Space/Project (and material, built the same way `seed.ts` builds its demo PDFs — a small hand-crafted PDF with real embedded text, no external PDF library needed) under a dedicated `eval-runner@aitutor.local` account, and deletes them at the end of the run. `eval_result` rows are **not** deleted — that table has no FK to projects/spaces and is the actual point of the script (decision: "modelSnapshot... enables regression comparison" in `04-DATA-MODEL.md`), so every run's history survives and is what the Admin Dashboard's "AI Evaluation" tab reads from.

If a suite's fixture setup itself fails (material processing errors, an AI provider outage), that suite's cases are recorded with verdict `error` and a note explaining why, and the run continues to the next suite rather than aborting — the same "fail loudly per case, don't crash the whole report" approach `seed.ts` uses for its own setup.

## Current status (as of 2026-09-16)

Two live runs were made while building this harness. Both suites' fixture setup failed identically: **Gemini's free-tier *daily* quota for `gemini-3.6-flash` (20 requests/day) was already exhausted** from earlier live testing/seeding in the same session (see `CLAUDE.md`'s note on this and the `withRetry()` fix in `aiProvider/base.ts` that detects it and fails fast instead of retrying uselessly). Both runs demonstrated the harness's plumbing works correctly end-to-end — user creation, fixture setup, per-suite error isolation, `eval_result` writes, cleanup — right up to the point the exhausted quota made every material-processing call fail, exactly as designed for that failure mode. All 7 cases (across both runs, 14 total) are recorded in `eval_result` with verdict `error` and the real error message.

**A full pass/fail run needs to happen once the daily quota resets** (or against a different Gemini API key/project). Re-running is just `npm run eval --workspace apps/api` — no code changes needed.
