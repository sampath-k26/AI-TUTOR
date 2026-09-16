# AI Study Companion (AI-TUTOR)

An AI-powered learning workspace built against the "AI Study Companion" PRD (v3.0 — Candidate Challenge Edition): Spaces → Projects, an AI Tutor grounded in the learner's own uploaded materials with page-level citations, adaptive quizzes (MCQ + open-ended), concept mastery tracking with growth trends, generated recommendations, Project/Global Analytics, and a role-gated Admin Dashboard — one persistent learning loop, not a bundle of disconnected AI features.

**Status:** Must-Haves (M0–M6) complete — full loop working end-to-end and live-verified against a real Supabase project with real Gemini/Groq calls. See `docs/06-IMPLEMENTATION-PLAN.md` for milestone detail and `docs/11-KNOWN-LIMITATIONS.md` for what's simplified.

## Documentation index

| Doc | Contents |
|---|---|
| [`docs/01-REQUIREMENTS-MAP.md`](docs/01-REQUIREMENTS-MAP.md) | Full PRD requirements, restructured and cross-referenced to data entities |
| [`docs/02-DECISIONS-LOG.md`](docs/02-DECISIONS-LOG.md) | Every product/architecture decision, what was chosen and why |
| [`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md) | Component diagram (renders on GitHub), module boundaries, core data flows, security model |
| [`docs/04-DATA-MODEL.md`](docs/04-DATA-MODEL.md) | Postgres schema (Supabase) |
| [`docs/05-FOLDER-STRUCTURE.md`](docs/05-FOLDER-STRUCTURE.md) | Full repo layout |
| [`docs/06-IMPLEMENTATION-PLAN.md`](docs/06-IMPLEMENTATION-PLAN.md) | Milestone-by-milestone build plan, testing strategy, disclosed simplifications |
| [`docs/07-SECURITY-PASS.md`](docs/07-SECURITY-PASS.md) | RLS audit, a live two-user cross-project-isolation attack, Supabase advisories, job idempotency |
| [`docs/08-EVALUATION.md`](docs/08-EVALUATION.md) | The golden eval set, how it's scored, how to run it |
| [`docs/09-AI-USAGE.md`](docs/09-AI-USAGE.md) | AI used to build this product vs. AI used by the product |
| [`docs/10-DEVELOPMENT-LOG.md`](docs/10-DEVELOPMENT-LOG.md) | Actual development prompts, organized by area |
| [`docs/11-KNOWN-LIMITATIONS.md`](docs/11-KNOWN-LIMITATIONS.md) | Honest limitations across AI, retrieval, documents, scaling, security, cost, UI, background processing |
| [`docs/12-DEPLOYMENT.md`](docs/12-DEPLOYMENT.md) | Step-by-step deploy to Render (API + worker) + Vercel (frontend) |
| [`docs/13-DEMO-VIDEO-SCRIPT.md`](docs/13-DEMO-VIDEO-SCRIPT.md) | Script for recording the required walkthrough video |
| [`CLAUDE.md`](CLAUDE.md) | Session rules for anyone (human or agent) continuing this build — locked stack, Node-version pin, module-boundary rules, real gotchas found live |

## Stack

- **Frontend:** React (Vite) + TypeScript, Tailwind CSS, deployed as a static build on Vercel
- **Backend:** Node.js + Express + TypeScript, modular monolith, deployed on Render (API + a separate worker process)
- **Data/Auth/Storage:** Supabase (Postgres + pgvector, Auth with Row-Level Security, file Storage)
- **Background jobs:** pg-boss (Postgres-native queue, no Redis)
- **AI:** Gemini (Tutor RAG, document understanding, embeddings, grading, recommendations) + Groq (fast MCQ generation), behind a shared `aiProvider` interface with retry/backoff
- **ORM/validation:** Drizzle ORM, Zod
- **Observability:** `ai_usage_log`/`events` Postgres tables (source of truth) + Langfuse Cloud (optional, supplementary)

See `docs/02-DECISIONS-LOG.md` for the reasoning behind each choice.

## Local setup

**Prerequisites:** Node **20.19.1** exactly (`node -v` — this is a hard constraint, see `CLAUDE.md`), npm ≥10, a Supabase project (free tier is fine), a Gemini API key, a Groq API key.

```bash
git clone https://github.com/sampath-k26/AI-TUTOR.git
cd AI-TUTOR
npm install    # installs both workspaces (apps/web, apps/api) from the root

cp apps/api/.env.example apps/api/.env   # fill in DATABASE_URL, SUPABASE_*, GEMINI_API_KEY, GROQ_API_KEY
cp apps/web/.env.example apps/web/.env   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

npm run db:migrate   # applies apps/api/db/migrations/ (schema + RLS policies) to your Supabase project

npm run dev:api      # http://localhost:4000
npm run worker       # separate terminal — pg-boss worker (materials processing, recommendations)
npm run dev:web      # separate terminal — http://localhost:5173
```

A Supabase project needs a public Storage bucket named `materials` (Storage → New bucket) before material uploads will work.

### Common commands (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev:api` / `npm run dev:web` | Run the backend / frontend in watch mode |
| `npm run worker` | Run the pg-boss worker in watch mode |
| `npm run test:api` / `npm run test:web` | Run the backend (83+ tests) / frontend test suites |
| `npm run typecheck:api` / `npm run typecheck:web` | Typecheck each app |
| `npm run lint:api` / `npm run lint:web` | Lint each app |
| `npm run seed` | Populate demo data by calling the real service layer (see below) |
| `npm run eval` | Run the golden evaluation suite against real AI providers (see `docs/08-EVALUATION.md`) |
| `npm run db:migrate` | Apply pending Drizzle migrations to `DATABASE_URL` |

### Seeding demo data

```bash
npm run seed
```

Creates one admin account and two learner accounts, each with a Space, a Project, a real uploaded/processed material, a grounded + an off-topic Tutor exchange, a scored quiz, and (usually) a generated recommendation — by calling the same service-layer functions the app itself uses, never raw SQL fixtures (see the Seed Data Strategy in `docs/02-DECISIONS-LOG.md`). Idempotent — safe to re-run; it skips any demo user that already exists. Makes real Gemini/Groq calls, so it needs working API keys and enough of each provider's quota (see `docs/11-KNOWN-LIMITATIONS.md`'s note on Gemini's free-tier daily cap if this fails partway through).

## Testing

```bash
npm run test:api   # 83+ unit tests: auth, cross-project isolation, mastery math, adaptive selection, background-job retry, observability, retry/backoff logic
npm run test:web   # critical-flow tests: auth gating, the full quiz interaction, the API client contract
```

`docs/07-SECURITY-PASS.md` also documents a manual live test: two real users, real JWTs, a deliberate attempt by one to read/write the other's data across every module — every endpoint failed closed with a 404, never a data leak.

## Deployment

See `docs/12-DEPLOYMENT.md` for the full runbook. Summary: Supabase is already hosted; `render.yaml` at the repo root is a Render Blueprint for the API + worker; `apps/web/vercel.json` adds the SPA rewrite Vercel needs for React Router.

## Known limitations & future improvements

See `docs/11-KNOWN-LIMITATIONS.md` — several of these were found live while building (a Gemini free-tier daily quota, a pgvector-extension-in-public-schema advisory, a background-job idempotency gap), not guessed at. M8+ (streaming Tutor responses, caching, one signature creative feature) is tracked in `docs/06-IMPLEMENTATION-PLAN.md`.
