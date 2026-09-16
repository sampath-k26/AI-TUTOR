# CLAUDE.md — Rules for working on AI-TUTOR

This file governs every session that works on this repository. Read it before making changes. The full plan lives in `docs/` — read the relevant doc before touching a related area:

- `docs/01-REQUIREMENTS-MAP.md` — what the product must do (source of truth for requirements)
- `docs/02-DECISIONS-LOG.md` — locked architecture/tech decisions and why. **Do not silently deviate from a locked decision.** If a new decision comes up that isn't covered here and is genuinely ambiguous or consequential, ask the user — don't guess and don't block work waiting on a trivial one.
- `docs/03-ARCHITECTURE.md` — component diagram, data flows, security model
- `docs/04-DATA-MODEL.md` — Postgres schema
- `docs/05-FOLDER-STRUCTURE.md` — where code goes
- `docs/06-IMPLEMENTATION-PLAN.md` — milestone order (M0 → M8+). **Build in this order.** Must-Haves (M0-M7) are complete and solid before any Should/Nice-to-Have (M8+) work starts.

## Locked technology stack (do not change without asking)

- Frontend: React (Vite) + TypeScript
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

## Environment variables / secrets

- Real credentials (Supabase URL/keys, Gemini API key, Groq API key) are **not available yet** — the user fills `.env` files in personally, at the end of implementation, right before the testing phase begins.
- Every required variable must be documented with a placeholder in `.env.example` (root and/or per-app as appropriate) the moment code starts depending on it — never let an env var be needed without a corresponding example entry.
- Real `.env`/`.env.local` files are gitignored. Never commit a real secret. Never print a secret value to the terminal/logs.
- Because live external credentials aren't available during the build phase: write code against the real SDKs/clients (no fake abstractions "for now"), but make it possible to build, lint, type-check, and run non-external unit tests without live Supabase/Gemini/Groq access. Use a local Postgres (via `docker-compose.yml`, pgvector-enabled image) for schema/migration/repository-level development and testing, so DB-touching code can actually run before Supabase credentials exist. Mock/stub `aiProvider` calls in unit tests rather than hitting real AI APIs. Full end-to-end testing against live Supabase/Gemini/Groq happens after the user fills in `.env` — flag clearly when a milestone's "exit check" needs that live testing pass rather than claiming it's verified.

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

- A module's `repository.ts` is the **only** file allowed to run SQL/Drizzle queries for that module's tables. Other modules call its `service.ts` exports — never import another module's `repository.ts` directly.
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
