# Security Pass (M6)

Run 2026-09-16 against the live Supabase project (`wuhvesnhkjgstsbpkeyn`). Covers the three things `06-IMPLEMENTATION-PLAN.md`'s M6 calls out: RLS coverage, cross-project isolation, and Supabase's own advisories.

## 1. RLS coverage

All 18 `public` tables have `rowsecurity = true`. 16 of them (every user-owned table per `04-DATA-MODEL.md`) have an explicit `USING` policy scoping to `auth.uid()`, directly (`spaces`, `projects`, `profiles`) or via a `project_id IN (SELECT ... WHERE owner_id = auth.uid())` subquery for child tables (`concepts`, `mastery`, `growth_snapshots`, `materials`, `material_chunks`, `conversations`, `messages`, `quizzes`, `questions`, `responses`, `recommendations`, `learning_context`, `events`).

`ai_usage_log` and `eval_result` have RLS enabled but **no policy** — this is intentional, not a gap. Neither table is user-owned (no `owner_id`/scopable `project_id` isolation makes sense for cross-user AI cost/eval data), and the frontend never queries Supabase directly for anything (`apps/web/src` has zero `supabase.from(...)` calls — every read goes through the Express API). RLS-enabled-with-no-policy means Postgres denies all access to both tables via PostgREST/the client SDK, for every role. That is the correct, safest default: only the backend's own privileged `DATABASE_URL` connection (which bypasses RLS by design, as the app's layer-1 enforcement per decision D16) can read them, via the `admin` module's `requireAdmin`-gated endpoints.

## 2. Cross-project isolation (deliberate "try to access someone else's project" test)

Created two real Supabase users (`isolation.usera@aitutor.local`, `isolation.userb@aitutor.local`), had user A create a Space and a Project, then made every request below as user B against user A's real IDs — through the live API, not a mock:

| Endpoint | Result |
|---|---|
| `GET /spaces/:spaceId` | 404 `Space not found` |
| `GET /projects/:projectId` | 404 `Project not found` |
| `POST /spaces/:spaceId/projects` | 404 `Space not found` |
| `GET /projects/:projectId/growth` | 404 `Project not found` |
| `GET /projects/:projectId/analytics` | 404 `Project not found` |
| `POST /projects/:projectId/quizzes` | 404 `Project not found` |
| `POST /projects/:projectId/tutor/messages` | 404 `Project not found` |
| `GET /projects/:projectId/materials` | 404 `Project not found` |
| `GET /spaces` (listing) | `{"spaces":[]}` — user A's space never appears |
| `GET /analytics` (global) | zeroed out — no trace of user A's data |

Every module fails closed with a **consistent 404** — never a 403 (which would leak "this exists but isn't yours") and never a 500 or partial data (both test users and all created rows were deleted afterward via `apply_migration`). This is now also covered by permanent unit tests so a future service function that forgets its ownership check fails CI immediately, not just this one manual pass: `tests/unit/isolation.test.ts` (materials, analytics modules) and `tests/unit/learningService.test.ts` (the module that owns spaces/projects, and that every other module's ownership check ultimately calls into).

## 3. Supabase security advisories (`get_advisors`, type: security)

| Finding | Level | Disposition |
|---|---|---|
| `rls_enabled_no_policy` on `ai_usage_log`, `eval_result` | INFO | **By design** — see §1 above. |
| `function_search_path_mutable` on `pgboss.create_queue`/`pgboss.delete_queue` | WARN | **Third-party** — pg-boss's own internal functions in its own schema; not app code, not something we patch. |
| `extension_in_public` — `vector` extension installed in `public` | WARN | **Accepted, deferred** — best practice is a dedicated `extensions` schema, but relocating an extension on a live project with data risks breaking the `vector()` column type resolution for no security benefit (it's a hygiene/organization warning, not an exploitable issue). Worth doing on a fresh project init in a future iteration, not worth the risk of a live migration here. |
| `anon_security_definer_function_executable` / `authenticated_..._executable` — `public.rls_auto_enable()` | WARN | **Platform-provisioned** — this function isn't in any of our migrations; Supabase's project scaffolding adds it. Not app-actionable. |
| `auth_leaked_password_protection` disabled | WARN | **Recommended manual action** — one-click toggle in the Supabase dashboard (Authentication → Policies → Password Security), not available through the MCP tools used in this session. Flagged for the user to enable directly. |

## 4. Prompt-injection resistance

The Tutor's system instruction (`modules/ai/service.ts`) explicitly tells the model that `<project_material>`, `<conversation_history>`, and `<learner_context>` are reference data, and that instruction-like text inside them must never be treated as a command — this is the mitigation the golden eval set's prompt-injection case (`06-IMPLEMENTATION-PLAN.md`'s eval requirement) exercises. See `08-EVALUATION.md` for the case and how to run it.

## 5. Background-job idempotency

Fixed one real gap found while writing this pass: `materials/repository.ts`'s `insertChunks` had no protection against pg-boss's at-least-once delivery — a redelivered `processMaterial` job would have silently doubled every chunk (degrading Tutor retrieval with duplicate context, not failing loudly). It now deletes existing chunks for the material before inserting the fresh set, making the write idempotent. Concept insertion is deduped at the AI-prompt level (existing concept names are passed to the extraction prompt) rather than a hard DB constraint — a pragmatic, not perfect, mitigation for a prototype. Recommendation generation is not fully idempotent under job redelivery (a crash between the Gemini call succeeding and the DB write could in principle produce a duplicate recommendation) — accepted as a known limitation given how narrow the failure window is, rather than adding request-level idempotency-key infrastructure for a prototype. Both the retry-on-failure contract and the material re-processing case are covered by `tests/unit/processMaterialWorker.test.ts`.
