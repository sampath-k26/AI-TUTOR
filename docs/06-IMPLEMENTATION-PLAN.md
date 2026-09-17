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

### M8 — Rich Document Understanding
- Persist concept descriptions: `extractConcepts()` already returns `{name, description}`, but `workers/processMaterial.ts` drops `description` before insert — pass it through; `concepts.description` already exists (nullable), no migration.
- Structure-aware chunking: `chunking.ts`'s `chunkPage()` prefers cutting at the last sentence boundary (`. `/`? `/`! `) within a lookback window near the target size, falling back to the hard character cutoff only when none is found — scoped to sentence boundaries only, since the upstream whitespace-collapse step already destroys paragraph breaks before chunking runs.
- Batch vision fallback: new `understandDocumentBatch()` on the AI provider interface, up to ~4 flagged low-text pages per Gemini call (page-delimited prompt/response) instead of one call per page; a page missing its delimiter in the model's response is left out of the result map (keeps its original extracted text) rather than overwritten with empty text.
- **Exit check:** upload a multi-page PDF with real prose and a scanned page; confirm concepts show non-null `description`, a chunk boundary lands after sentence-ending punctuation, and vision fallback produces fewer `ai_usage_log` rows than flagged pages.

### M9 — Streaming Tutor Responses
- New `generateTextStream()` on the AI provider (plain-text `generateContentStream`, no JSON schema) — usage logging fires only once the stream fully drains; `withRetry()` wraps stream *establishment* only, never the token-consumption loop.
- New `handleTutorMessageStream()` alongside the existing `handleTutorMessage()` (left untouched — `scripts/runEval.ts` imports it directly, not over HTTP): same evidence gate and citation-validation logic, but the model streams prose first, then a fixed delimiter, then a JSON citations tail; tokens forward to the client as they arrive, delimiter-and-tail are buffered and validated after the stream ends.
- New decision **D17**: if citation validation fails *after* prose has already streamed, don't retroactively hide it (can't un-render read tokens) — flag it with a distinct `groundingUncertain` notice instead. Weakens D11's guarantee for the streaming path only; the non-streaming endpoint is unaffected.
- Transport: newline-delimited JSON over an authenticated `fetch` POST (not native `EventSource`, which can't carry the app's Bearer header) — new `POST .../tutor/messages/stream` route, new `apiClient.postStream()`, `TutorTab.tsx` appends deltas to a live message.
- Companion fix: `main.ts`'s global error handler is missing a `res.headersSent` check — a pre-existing latent bug this feature would otherwise expose as `ERR_HTTP_HEADERS_SENT`.
- **Exit check:** a grounded question renders token-by-token with an accurate final citation; `runEval.ts` still passes unmodified against the untouched non-streaming path.

### M10 — Improved Analytics (Time-Series Charts)
- New day-bucketed aggregation queries on data that already exists: mastery-over-time (`growth_snapshots`), AI usage-over-time (`ai_usage_log`), engagement-over-time (`events`) — no new tables.
- One reusable hand-rolled SVG `LineChart` component (no charting library — keeps the frontend's dependency surface at zero for this concern); wired into Growth, Project Analytics, and Admin Engagement/AI&System tabs.
- **Exit check:** a Project with quiz activity across multiple days shows a real multi-point mastery line per concept, not flat/mock data.

### M11 — In-Process Caching
- New `core/cache.ts`: a `Map`-based TTL `withCache(key, ttlMs, fn)` wrapper (~30s), applied only to the repeated-read aggregations in `analytics/repository.ts` and `admin/repository.ts` — never to Growth's live mastery reads or Admin's System Health checks, which must stay real-time.
- Hard rule: every project/owner-scoped cache key embeds that scoping ID, or this reintroduces a cross-tenant leak against D16.
- New decision **D18**: in-process, not Redis — extends the existing no-Redis precedent (A3/D13); accepted limitation that it's per-process and cold after every deploy/restart.
- **Exit check:** two rapid calls to the same project's analytics endpoint hit the DB once; two different projects' calls never leak each other's cached values.

### M12 — Concept Maps
- Lives inside `materials` (same precedent as `recommendations` living inside `assessment`), computed live per request rather than precomputed: `concepts` has no idempotent reprocessing story the way `material_chunks` does, and co-occurrence is inherently project-wide, so a precomputed table would need a full recompute on every reprocess — live sidesteps that entirely.
- New decision **D19**: edges from heuristic substring co-occurrence (concepts sharing a material chunk, weighted by shared-chunk count) — zero extra Gemini calls, not an AI-inferred-relationship call. Named limitation: substring matching is a coarse proxy for true semantic relationship.
- New `GET /projects/:id/concept-map`; frontend renders a fixed circular layout (no graph library) with edge thickness scaled by weight.
- **Exit check:** a Project with concepts spanning 2+ materials shows at least one edge with visibly different thickness for a more-frequently-co-occurring pair.

### M13 — Learning Plans
- New module (`modules/learningPlans/`, following the `assessment` template exactly) and the only M8+ milestone needing a schema migration: `learning_plans` (one active plan per Project, archived on regenerate) + `learning_plan_steps` (ordered, typed, checkable, optionally linked to a material/concept via `onDelete: "set null"`), plus an RLS policy migration mirroring `0001_rls_policies.sql`'s pattern.
- Generation is synchronous and user-triggered (not a background job — matches `generateNextQuestion`'s pattern, not `generateRecommendation`'s): one Gemini structured call producing an ordered checklist (review material X / ask the Tutor about Y / take a quiz on Z) from the Project's goal, current mastery, and weak concepts.
- New "Plan" tab following the existing tab convention exactly (toast on generate, optimistic checkbox updates, skeleton loading state).
- **Exit check:** a generated plan references a known weak concept by name; a completed step survives a page refresh; regenerating archives the old plan rather than duplicating it.

Should-Haves (M8–M11) before Nice-to-Haves (M12–M13), per the same Must-Have-first scope discipline this project has followed throughout.

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
