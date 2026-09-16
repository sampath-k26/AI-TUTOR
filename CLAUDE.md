# CLAUDE.md — Rules for working on AI-TUTOR

This file governs every session that works on this repository. Read it before making changes. The full plan lives in `docs/` — read the relevant doc before touching a related area:

- `docs/01-REQUIREMENTS-MAP.md` — what the product must do (source of truth for requirements)
- `docs/02-DECISIONS-LOG.md` — locked architecture/tech decisions and why. **Do not silently deviate from a locked decision.** If a new decision comes up that isn't covered here and is genuinely ambiguous or consequential, ask the user — don't guess and don't block work waiting on a trivial one.
- `docs/03-ARCHITECTURE.md` — component diagram, data flows, security model
- `docs/04-DATA-MODEL.md` — Postgres schema
- `docs/05-FOLDER-STRUCTURE.md` — where code goes
- `docs/06-IMPLEMENTATION-PLAN.md` — milestone order (M0 → M8+). **Build in this order.** Must-Haves (M0-M7) are complete and solid before any Should/Nice-to-Have (M8+) work starts.

## Locked technology stack (do not change without asking)

- Frontend: React (Vite) + TypeScript, styled with Tailwind CSS v3 + a small shadcn/ui-style component set (`src/components/ui/`: button, card, input, textarea, label, badge). Design tokens (HSL CSS variables in `src/index.css`, mapped in `tailwind.config.js`) are adapted from a reference "Linear-grade" design language (near-black canvas, four-step surface ladder, hairline borders instead of shadows, a single lavender-blue accent `#5e6ad2`) — read `~/Documents/Zopkit/Project-Management-master` for the original if extending this further, but never write to that repo. Dark mode follows OS preference (`darkMode: 'media'`) — there is no manual theme toggle, and none should be added without asking (scope discipline).
- Backend: Node.js + Express + TypeScript, modular monolith
- DB/Auth/Storage: Supabase (Postgres + pgvector, Auth with RLS, Storage)
- Background jobs: pg-boss (Postgres-native, no Redis)
- AI: Gemini (Tutor RAG, document understanding, embeddings, grading, recommendations) + Groq (quiz question generation), behind a shared `aiProvider` interface
- DB access: Drizzle ORM + raw SQL for pgvector queries
- Validation: Zod
- Observability: `ai_usage_log`/`event` Postgres tables (source of truth) + Langfuse Cloud (supplementary)

## Node version — strict rule

The user's local Node version is **fixed and must never be changed by Claude**:

```
node -v   →  v20.19.1
npm -v    →  10.8.2
```

- **Before installing any package**, run `node -v` and confirm it still matches. If it doesn't, stop and tell the user — do not proceed with installs.
- **Never** run `nvm install`, `nvm use`, `nvm alias default`, `n install`, or edit `.nvmrc`/Volta config to change the active Node version. Never suggest or perform a Node upgrade/downgrade as a fix for a package issue — instead pick a package version compatible with Node 20.19.1.
- Set `"engines": { "node": ">=20.19.0 <21" }` in every `package.json` so this constraint is explicit and checked by tooling.
- When choosing a package version, verify it supports Node 20 before installing (check the package's `engines` field or release notes) — do not install a package that requires a newer Node major version.
- Package manager is **npm** (via npm workspaces) — pnpm and yarn are not installed locally; do not introduce them.

### Packages pinned below `latest` because of the Node 20 constraint

As of this build (Sep 2026), several packages have bumped their minimum Node version to 22+ (Node 20 hit EOL this year). These are pinned to the last version compatible with Node 20.19.1 — **do not run `npm update` or `npm install <pkg>@latest` on these**, it will silently pull in a version that doesn't run on this machine:

| Package | Pinned | Why (latest requires) |
|---|---|---|
| `@supabase/supabase-js` | `2.109.0` (exact, no `^`) | `2.110.0+` requires Node `>=22.0.0` |
| `pdfjs-dist` | `5.5.207` (exact, no `^`) | `5.6.83–6.2.107` have a high-severity security advisory (arbitrary JS execution on a malicious PDF via `npm audit`) — matters directly since we parse user-uploaded PDFs — and separately `5.7.284+` requires Node `>=22.13.0` anyway. `5.5.207` predates the vulnerable range and is still Node-20 compatible. |
| `pg-boss` | `^10.4.2` (stay in the `10.x` line) | `11.x`/`12.x` require Node `>=22` |
| `vitest` | `^4.1.11` (stay in the `4.x` line) | `5.x` requires Node `^22`/`^24`/`>=26` |
| `jsdom` (apps/web, dev) | `^29.1.1` (stay in the `29.x` line) | `30.x` requires Node `^22.22.2`/`^24.15.0`/`>=26` |
| `@testing-library/jest-dom` (apps/web, dev) | `6.9.1` (exact, no `^`) | `6.10.0` was a **broken release**, not a normal version bump — its own deprecation notice says it mistakenly requires Node `>=22` and a new peer dep; the package's own advice is "use 6.9.1 for the 6.x line, or upgrade to 7.0.0" (7.x also requires Node `>=22`). Pinned exact so `npm install` never silently resolves back up to it. |
| `concurrently` (if introduced) | `^9.x` line only | `10.x` requires Node `>=22` |
| `typescript` (both apps) | `~6.0.2` (not `^7.x`) | TypeScript 7 is a new native/Go compiler; `typescript-eslint` (peer range `>=4.8.4 <6.1.0`, confirmed via its `canary` tag too) does not support it yet. Not a Node-version issue — a tooling-ecosystem gap. Revisit once typescript-eslint adds TS7 support. |

Everything else in `apps/api/package.json`/`apps/web/package.json` was verified against `npm view <pkg> engines` at scaffold time and is fine on Node 20.19.1 at its current `latest`. If you add a **new** dependency later, run `npm view <pkg> engines` first and apply the same check before installing.

### Runtime gotcha not caught by `engines` or typecheck: `@supabase/supabase-js` needs a WebSocket polyfill on Node 20

`createClient()` always constructs a Realtime client, which throws **at construction time** — `Error: Node.js 20 detected without native WebSocket support` — even though we never use Realtime and even though the package's declared `engines` says Node `>=20` is fine. This only surfaces when the code actually runs (not at typecheck/lint time), so it's easy to miss. Fixed via `src/core/supabaseClientOptions.ts`, which passes the `ws` package as the realtime transport (`createClient(url, key, supabaseClientOptions)`) — **every** `createClient()` call in this backend must pass `supabaseClientOptions` as the third argument, or it will throw the first time anything touches that client (auth verification, storage, etc.).

## Environment variables / secrets

- Real Supabase credentials exist and are fully populated in `apps/api/.env`/`apps/web/.env`: `DATABASE_URL` (transaction pooler), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` — project `wuhvesnhkjgstsbpkeyn` ("aitutor", region ap-northeast-2), created 2026-09-16.
- The Supabase MCP tools (`mcp__claude_ai_Supabase__*`) already have live access to this exact project — use them for schema/data verification (migrations, `list_tables`, `execute_sql` for reads, `get_advisors`) instead of asking for a docker-compose Postgres. **Only ever target `project_id: "wuhvesnhkjgstsbpkeyn"`** — the account has at least two other, unrelated Supabase projects; never run a migration/query against them.
- `execute_sql` is read-only (it runs in a read-only transaction) — use `apply_migration` for any INSERT/UPDATE/DELETE/DDL, even one-off test-data mutations, not just schema changes.
- Supabase Auth JWTs are verified via `supabase.auth.getClaims()` (see `core/auth.ts`), not a static HS256 secret — this project uses the current default asymmetric (ES256/JWKS) signing keys, not the legacy shared-secret scheme, so there is no `SUPABASE_JWT_SECRET` to configure.
- New Supabase projects require email confirmation before `signUp()` returns a session by default, and the public `signUp()`/`auth/v1/token` endpoints reject some domains outright (e.g. `.local` addresses fail with "Email address is invalid" before even reaching the rate limit) and separately enforce a low hourly email-send rate limit. For any test/demo user, skip the email path entirely: create it with the **service-role Admin API** (`supabase.auth.admin.createUser({ email, password, email_confirm: true })`, or `POST {SUPABASE_URL}/auth/v1/admin/users` with the service role key) — this bypasses both the domain check and the email rate limit, and the user is immediately confirmed. Then either call `GET /me` (bootstraps the `profiles` row) or, from a script, `learningService.ensureProfile(userId, email)` directly. Clean up any test users/rows created this way afterward (delete from `public.*` tables first, then `auth.users`, respecting FKs) — don't leave smoke-test data in the user's real project. **`profiles.id` has no enforced FK to `auth.users.id`**, and raw-`DELETE`-ing `auth.users` doesn't revoke already-issued JWTs (`getClaims()` verifies the signature/expiry, not a live DB lookup) — if a browser tab with an active session is still open against a user you just deleted, its next `/me` call will silently recreate an orphaned `profiles` row with no matching auth user. Close/don't reuse test browser tabs after cleanup, and if you find an orphaned profile later (an id with no `auth.users` row), it's safe to just delete it.
- **Gemini free tier has a genuinely low daily cap, not just a per-minute one.** Live-discovered running the seed script: `gemini-3.6-flash` free-tier quota is 5 requests/**minute** *and* 20 requests/**day** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier` in the 429's `quotaId`) — the daily cap is easy to exhaust in a single active session of live testing/seeding, and once it's hit, every `gemini-3.6-flash` call fails until the next day regardless of backoff. `aiProvider/base.ts`'s `withRetry()` detects a `PerDay` quotaId and does **not** retry it (retrying can't outlast a 24h reset — it would just delay surfacing the real error); a per-minute 429 still gets a longer backoff (`RATE_LIMIT_BASE_DELAY_MS`). If you hit this, real Gemini-dependent testing (Tutor, document understanding, embeddings, grading, recommendations) is blocked until the quota resets — say so plainly rather than silently retrying or reporting false success. Groq (MCQ generation) has a separate quota and is unaffected.
- Every required variable must be documented with a placeholder in `.env.example` (root and/or per-app as appropriate) the moment code starts depending on it — never let an env var be needed without a corresponding example entry.
- Real `.env`/`.env.local` files are gitignored. Never commit a real secret. Never print a secret value to the terminal/logs, and never echo one back in a chat response — write it straight into the `.env` file.
- `docker-compose.yml` (local Postgres+pgvector) is kept as a fallback only — Supabase's live dev project is the standard now. Mock/stub `aiProvider` calls in unit tests rather than hitting real AI APIs; that part of the original "build without live credentials" approach still applies to Gemini/Groq until those keys are provided.

## Git workflow — incremental commits

- Work in small, logically-scoped commits as each unit of work is completed — not one giant commit at the end. Roughly: one commit per meaningful sub-step within a milestone (e.g., "scaffold Express app skeleton", "add Drizzle schema for learning module", "implement spaces CRUD service+router+tests"), and always a commit at the end of each milestone in `docs/06-IMPLEMENTATION-PLAN.md`.
- Write commit messages in imperative mood, one line summary + optional body explaining *why* when non-obvious. No filler like "misc changes."
- Never `git add -A`/`git add .` blindly — review `git status` and stage specific files, so a stray local file (e.g., an accidental `.env`, editor cruft) never gets committed.
- Never force-push, never rewrite published history, never skip hooks (`--no-verify`) unless the user explicitly asks.
- Push to `origin main` after each milestone commit (or more often) once GitHub authentication is working. If a push fails due to auth, tell the user rather than retrying blindly or working around it.
- End every commit message with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

## Code organization rules (enforced by convention, not framework)

- A module's `repository.ts` is the **only** file allowed to run SQL/Drizzle queries for that module's tables. Other modules call its `service.ts` exports — never import another module's `repository.ts` directly. (Caught and fixed real instances of this in `ai` and `materials` importing `learning`'s repository/`projects` table and `ai` importing `materials`' table directly — grep for `from "\.\./learning/repository"` or similar cross-module repository imports if in doubt.)
  - Exception: a repository may `JOIN` a foreign table purely as an ownership/authorization filter in its own module's query (e.g. `materials/repository.ts` joining `projects` only to filter by `owner_id`, never selecting project columns as return data). Fetching another module's actual data (a filename, a name, a status) must go through that module's `service.ts`, not a join.
  - `material_chunks` is owned entirely by `materials` (both the write path from processing and the vector-similarity read path) — `materials.searchRelevantChunks(projectId, queryText, {topK, similarityThreshold})` is the one place that queries it. `ai/retrieval.ts` is a thin policy wrapper around it (owns the Tutor's grounding topK/threshold per decision D11); `assessment` calls the same materials function directly with its own topK/threshold for question-generation grounding rather than going through `ai`.
- `router.ts` files contain HTTP wiring only (parse request, call service, shape response) — no business logic.
- Every external AI call goes through `aiProvider` (`GeminiProvider`/`GroqProvider`) — never call the Gemini/Groq SDK directly from a module's service. Every call through `aiProvider` must be logged to `ai_usage_log`.
- Every Project-scoped query is explicitly filtered by the authenticated `user_id`/ownership in the service/repository layer, **and** the corresponding table has a Postgres RLS policy — both layers are required (see D16 in the decisions log), not just one.
- All API input is validated with Zod at the router boundary before it reaches a service function.

## Scope discipline

- Follow the Must-Have-first scope decision (P1): build every Must-Have requirement completely and solidly before starting any Should-Have or Nice-to-Have work.
- Don't add features, abstractions, or "just in case" flexibility beyond what the current milestone in `docs/06-IMPLEMENTATION-PLAN.md` calls for.
- If something in the PRD/plan is genuinely ambiguous and consequential, ask the user rather than assuming — but don't turn every small implementation detail into a question.

## Testing

- Follow the testing strategy in `docs/06-IMPLEMENTATION-PLAN.md` — meaningful coverage of auth/isolation, mastery math, adaptive selection, grounded-answer/citation behavior, and background job retry/idempotency, not exhaustive coverage of everything.
- The seed script (`apps/api/scripts/seed.ts`) must always be implemented by calling real service-layer functions — never raw SQL fixture inserts (see the Seed Data Strategy section of `docs/02-DECISIONS-LOG.md`). It is both demo-data generation and a smoke test.
