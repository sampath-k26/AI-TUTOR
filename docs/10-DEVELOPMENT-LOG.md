# Development Log

Actual prompts that drove this build, organized by area, per submission requirement §18.6. Quotes are verbatim (typos included) from the working sessions with Claude Code. This is a curated log of the prompts that changed direction or unblocked a decision, not a full transcript — routine "continue"/"looks good" turns are omitted.

## Architecture & planning

> "I have provided you a pdf of PRD... first go through the entire document and map the requirements first. then prepare an implementation plan for this. i will evaluate that and make appropriate changes for that and get that plan ready for implementation. There are many product decisions to be made. so instead of you taking the decisions, prompt for the required decisions. if you have any blockers, get the decision to be made by prompting instead of blinding executing."

> "implementation plan to be made such that the code should be implemented modularly so that it supports the future scalability and maintainability. use the web search extensively and prepare a best folder structure that suits this project/prototype. propose the best architecture. ask for any architectural decisions to be made that may seem ambiguous. so to start this create a project folder in this folder named AI-TUTOR and start your work."

This produced `01-REQUIREMENTS-MAP.md` through `06-IMPLEMENTATION-PLAN.md` before any code was written, and every subsequent architectural question in this log was surfaced *because* of this instruction — the agent was told explicitly to ask rather than assume.

## Product / scope decisions

> "i wanted to use free llm provider. so as it is a prototype i use gemini. i can get free gemini api which is cost effective for me. tell me is there any free llm providers other than gemini." → led to the Gemini + Groq combo (decision D7).

> "first build all the musthaves. after the base one is ready with all the requirements working, we can follow up with upgrades based on remaining time." → the Must-Have-first scope rule enforced throughout (`CLAUDE.md` "Scope discipline").

> "choose option-1. but none of them should be hardcoded. it should be like if one thing updates or changes all the related one or those linked should be updated to show the correctness of data. this seed should help so that we can also know any errors in the code." → the Seed Data Strategy in `02-DECISIONS-LOG.md`: the seed script must call real service-layer functions, never insert fixture rows, so it doubles as a smoke test.

> "One continuous build" → the build cadence for the rest of the project: implement in stages, only pause for genuine blockers, rather than checkpointing after every file.

> "as listed in the prd, confirm with me the technologies should be used." → a full round of tech-stack confirmation questions before implementation began (backend framework, retrieval approach, deployment targets), not assumed from the plan alone.

## Backend

> "i want to change the frontend because we are deploying in two hosts seperately. so make frontend to react and backend to express which helps in better deployment when comes to different hosts. as per my opinion. what would be your thought?" → pivoted the plan from Next.js/a single deployable to a separately-deployable React (Vite) frontend + Express backend, after the agent had explained Vercel's Hobby-plan limitations for hosting a persistent worker process.

> "continue implement it. before starting the initialize the git. ... while implementing, do follow to make incremental commits. write claude.md so that every session work on this project should follow those rules. also check my local node version before installing packages. make sure they match my local node version and you shouldnot update my node version. this is a strict rule. leave the env file at last. i will fill the credentials after implementation was completed." → set every process rule that governed the rest of the build: git initialization against the real GitHub remote, incremental commits, `CLAUDE.md` as the persistent session contract, the Node-20 pin as a non-negotiable constraint, and deferred credentials.

> "ok complete all the remaining things according to the implementation plan." → the instruction that drove M5 (User Home, Admin Dashboard, seed script), M6 (Langfuse, eval harness, security pass, tests), and M7 (this documentation set) in one continuous pass.

## Frontend

> "for ui adopt from the Documents/Zopkit/Project-Management-master. but donot perform any changes inthat repo." → the entire design system (dark "Linear-grade" theme, hairline borders, the `src/components/ui/` primitives) was ported by reading that reference repo read-only; compliance with "don't modify it" was explicitly re-verified before moving on.

## Database & infrastructure

> "1. Install ORM / Add the ORM to your project... [Supabase quickstart docs pasted] ... i have attached you to install supabase and its mcp for that project. use them instead of docker." → pivoted from a local Docker Postgres (which had become unresponsive) to the user's real Supabase project and its MCP tools, mid-build.

> "make sure u call only required db and dont change other db's data." → given the user's Supabase account has multiple unrelated projects, this became a hard rule (recorded in `CLAUDE.md`): every MCP call is scoped to project `wuhvesnhkjgstsbpkeyn` only, verified before every `apply_migration`/`execute_sql` call for the rest of the build.

## AI integration

Credentials for Gemini and Groq were provided directly in chat mid-build ("continue the build while I get those keys" was the standing instruction while they were being generated) and written straight into the gitignored `.env` — never echoed back in any response. Model-name and quota issues that followed (see Debugging below) were investigated and fixed without further user prompting, per the "continue the build" instruction already in effect.

## Debugging

Most debugging in this build was agent-initiated during live end-to-end testing, not user-reported — each was investigated using the app's own observability (`ai_usage_log.error_detail`) or direct API/DB introspection rather than guessing:
- A wrong JWT-verification method (HS256 secret vs. Supabase's current asymmetric signing keys) — caught via research before it ever failed live.
- A Node-20 WebSocket-polyfill requirement in `@supabase/supabase-js` that only threw at runtime, invisible to typecheck/lint.
- Two deprecated AI model names (`gemini-2.5-flash`, `llama-3.3-70b-versatile`), each diagnosed via a live 404 and the model's own `error_detail`.
- A real transient Gemini 503 → added `withRetry()`.
- A real Gemini 429 (`GenerateRequestsPerMinutePerProjectPerModel`) → lengthened the retry backoff.
- A real Gemini 429 (`GenerateRequestsPerDayPerProjectPerModel`, the *daily* quota) → made `withRetry()` detect and fail fast instead of wasting retries on an unrecoverable-within-the-process quota.
- A pg-boss at-least-once-delivery idempotency gap in material chunk insertion, found while writing the M6 security pass, not reported by any test failure.

## Testing

The testing approach itself was set by the initial planning prompt's "modularly... scalability and maintainability" instruction (meaningful coverage, not exhaustive) and executed without further prompting: 77+ backend unit tests, a live two-user cross-project-isolation attack against the real deployed database (`07-SECURITY-PASS.md`), and frontend tests for the flows judged most critical (auth gating, the full quiz interaction).

## Docs

This documentation set (`01`–`13`) was produced across two phases: the full planning suite before any code existed (per the initial prompt), and this M7 packaging pass (`08`–`13`) at the end, both without a separate prompt beyond the original planning instruction and "complete all the remaining things according to the implementation plan."
