# Implementation Plan

Approach: **one continuous build** (per your instruction), sequenced so that at every milestone the app is runnable and the core loop gets progressively more complete — never a half-wired feature blocking another. Must-Haves are built completely before any Should/Nice-to-Have is touched (per your scope decision).

## Milestones

### M0 — Foundation
- Repo scaffold per `05-FOLDER-STRUCTURE.md`; React (Vite) app + Express app boot with a health-check round trip.
- Supabase project: schema migration for `profiles, spaces, projects` (+ RLS policies), Auth wired end-to-end (signup/login on frontend, JWT verified on backend).
- `aiProvider` interface + `GeminiProvider`/`GroqProvider` stubs (real API calls, minimal prompts) wired to `ai_usage_log`.
- pg-boss installed and running one trivial no-op job end-to-end (proves the Postgres-native queue works before anything depends on it).
- **Exit check:** a user can sign up, log in, create a Space and a Project, and see them on a dashboard.

### M1 — Materials & Knowledge Pipeline
- Upload endpoint → Supabase Storage → `materials` row (`queued`) → pg-boss `processMaterial` job.
- Local extraction (pdfjs-dist) with page-aware chunking; Gemini vision fallback for low-text-density pages; Gemini embeddings → `material_chunks` (pgvector).
- Concept extraction pass → `concepts` table (deduped per project).
- Status polling UI (`queued/processing/ready/failed`), retry on failure.
- **Exit check:** upload a real PDF (including one scanned page), watch it move to `ready`, and confirm chunks + concepts exist with correct page numbers.

### M2 — AI Tutor (grounded RAG + citations)
- Retrieval: embed query → pgvector similarity search scoped to `project_id`.
- Evidence gate + structured-output citation validation (decision D11).
- Conversation persistence, bounded context window, `learning_context` composition.
- Unsupported-question handling branch (§7) — must be demonstrably testable, not just "hopefully the prompt handles it."
- **Exit check:** ask a question answerable from the material → get an answer with an accurate page citation; ask an out-of-scope question → get an explicit "insufficient evidence" response, not a fabricated answer.

### M3 — Adaptive Quiz & Assessment
- Question generation: Groq for MCQ, Gemini for open-ended, grounded in Project material/concepts.
- Selection algorithm (concept/difficulty ranking per `03-ARCHITECTURE.md` §5).
- Grading: deterministic for MCQ, Gemini structured evaluation for open-ended (never a bare score).
- Mastery update (EMA formula, D12) + `growth_snapshots` write on every update.
- **Exit check:** take a quiz across multiple concepts, confirm mastery moves sensibly (not a simplistic wrong→easy ladder) and growth history records each change.

### M4 — Growth, Recommendations, Analytics
- Growth Analysis view (Improving/Stable/Requires Attention classification from `growth_snapshots`).
- Recommendation generation workflow (triggered on quiz completion + repeated-mistake detection), avoiding repetition of prior recommendations.
- Project Analytics + Global Analytics views built from `events`.
- Background workflows for repeated-mistake detection wired to real event data.
- **Exit check:** completing a quiz visibly updates Growth, produces a new Recommendation, and shows up in Project/Global Analytics — the full §19 success-criteria loop is now traceable end-to-end.

### M5 — User Home, Admin Dashboard, Seed Script
- User Home: Continue Learning, Recent Projects, overall progress, areas requiring attention, recommended next action.
- Admin Dashboard: users, Spaces, Projects, activity (filterable), engagement, learning analytics, AI usage, AI evaluation, background processing status, system health — role-gated server-side.
- Seed script (`apps/api/scripts/seed.ts`) built to call service-layer functions per the seed strategy in `02-DECISIONS-LOG.md` — run it, confirm the Admin Dashboard shows coherent, cross-linked demo data.
- **Exit check:** an admin account can inspect a seeded user's full learning journey and platform-wide activity.

### M6 — Observability, Evaluation, Security Pass, Tests
- Langfuse wired to mirror `ai_usage_log` calls.
- Golden eval set (`apps/api/eval/cases/`) + `apps/api/scripts/runEval.ts` covering Tutor groundedness, unsupported-question handling, quiz grading, recommendation relevance.
- Security pass: confirm RLS policies on every user-owned table, confirm cross-project isolation with a deliberate "try to access someone else's project" test, prompt-injection test case added to the golden set.
- Test suite: backend unit/integration tests for auth, isolation, mastery math, adaptive selection, background job retries; a handful of frontend tests for critical flows.
- **Exit check:** `runEval.ts` produces a report; isolation test fails closed (403/404, not data leakage); test suite passes in CI or locally with a documented command.

### M7 — Deployment & Submission Packaging
- Deploy: Vercel (frontend, static build), Render/Railway (Express API + worker), Supabase (already hosted).
- `.env.example`, README setup/deployment instructions, architecture diagram export.
- AI-usage documentation (build-time AI tools vs product AI features), development-prompts log, evaluation write-up, known limitations, future improvements.
- Record demo video walking the full loop from `01-REQUIREMENTS-MAP.md` §17/§18.
- **Exit check:** the public URL demonstrates the full loop from a clean browser session; repo is public and self-explanatory to a stranger.

### M8+ — Should/Nice-to-Have (only after M0-M7 are solid)
In priority order if time remains: streaming Tutor responses (SSE) → caching for repeated retrieval/analytics queries → persistent Tutor continuity refinements → automated regression evaluation (run `runEval.ts` in CI) → one signature creative feature (candidates per PRD §21: concept map visualization, spaced-repetition scheduling, or similar) — chosen based on remaining time, not committed to upfront.

---

## Testing strategy (maps to PRD §16)

| Area | What's tested |
|---|---|
| Backend | JWT auth rejection paths, RLS + service-layer isolation (cross-project access attempts), input validation edge cases, core business logic (mastery math, selection ranking) |
| AI | Grounded-answer citation accuracy against a fixture document, unsupported-question branch triggers correctly, structured-output schema validation (malformed model output is caught, not silently passed through), prompt-injection resistance case |
| Learning | Mastery update formula unit tests (known input → expected output), adaptive selection doesn't repeat recent questions, recommendation generation doesn't repeat prior active recommendations |
| Background processing | Successful job completion, retry on transient failure, idempotency (duplicate event doesn't double-apply a mastery update) |

## Known simplifications to disclose in the submission (per PRD §17/§20)

- Mastery uses a weighted-evidence heuristic, not BKT/IRT — documented as a deliberate cold-start-friendly simplification (D12).
- Retrieval is custom/lightweight, not a full RAG framework — chosen for observability/control within the timebox (D9).
- Background queue is Postgres-native, not Redis-backed — sufficient at prototype scale/concurrency (A3).
- Evaluation is a small golden set + LLM-judge, not exhaustive automated regression coverage in CI (D15) — named explicitly as a "Should Have" follow-up.
