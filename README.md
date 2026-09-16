# AI Study Companion (AI-TUTOR)

An AI-powered learning workspace built against the "AI Study Companion" PRD (v3.0 — Candidate Challenge Edition): Spaces/Projects, an AI Tutor grounded in the user's own materials with citations, adaptive quizzes, concept mastery tracking, growth analysis, recommendations, and an admin dashboard — connected into one persistent learning loop rather than a bundle of disconnected AI features.

**Status:** Planning complete, implementation not yet started. This repository currently contains the requirements analysis, architecture, data model, folder structure, and implementation plan produced from the PRD — for review before code is written.

## Start here

| Doc | Contents |
|---|---|
| [`docs/01-REQUIREMENTS-MAP.md`](docs/01-REQUIREMENTS-MAP.md) | Full PRD requirements, restructured and cross-referenced to implied data entities |
| [`docs/02-DECISIONS-LOG.md`](docs/02-DECISIONS-LOG.md) | Every product/architecture decision, what was chosen, why, and what's still a proposed default open for pushback |
| [`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md) | System architecture, component diagram, core data flows (materials pipeline, Tutor RAG, adaptive quiz), security & observability design |
| [`docs/04-DATA-MODEL.md`](docs/04-DATA-MODEL.md) | Postgres schema (Supabase) |
| [`docs/05-FOLDER-STRUCTURE.md`](docs/05-FOLDER-STRUCTURE.md) | Full repo layout |
| [`docs/06-IMPLEMENTATION-PLAN.md`](docs/06-IMPLEMENTATION-PLAN.md) | Milestone-by-milestone build plan, testing strategy, disclosed simplifications |

## Planned stack (see decisions log for rationale)

- **Frontend:** React (Vite) + TypeScript, static build deployed on Vercel
- **Backend:** Node.js + Express + TypeScript, modular monolith, deployed on Render/Railway
- **Data/Auth/Storage:** Supabase (Postgres + pgvector, Auth with Row-Level Security, file Storage)
- **Background jobs:** pg-boss (Postgres-native queue, no Redis)
- **AI:** Gemini (Tutor RAG, document understanding, embeddings, grading, recommendations) + Groq (fast adaptive-quiz question generation), behind a shared provider-abstraction interface
- **DB access:** Drizzle ORM, with raw SQL for pgvector similarity queries
- **Validation:** Zod
- **Observability:** first-party `ai_usage_log`/`event` tables (source of truth for the Admin Dashboard) + Langfuse Cloud free tier for trace-level debugging

## Next step

Review `docs/02-DECISIONS-LOG.md` — items marked `PROPOSED DEFAULT` are open for change; everything else (including the full Round 3 stack confirmation) is locked. Once confirmed, implementation proceeds per `docs/06-IMPLEMENTATION-PLAN.md`.
