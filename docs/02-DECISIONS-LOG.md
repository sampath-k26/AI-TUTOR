# Architecture & Product Decisions Log

Every non-obvious decision behind the plan, in one place, so it can be challenged individually. Status `CONFIRMED` = you chose this explicitly. Status `PROPOSED DEFAULT` = I selected it based on the research in this folder and the PRD's principles, but it is **not locked** — flag any of these and I'll rework the plan before implementation starts.

---

## Product decisions (Round 1)

| # | Decision | Chosen | Status |
|---|---|---|---|
| P1 | Scope ambition for the 3-4 day window | Build **all Must-Haves** completely first; Should/Nice-to-Have only after the base loop works end-to-end | CONFIRMED |
| P2 | Admin dashboard demo data | A **seed script**, not hardcoded fixtures — see [Seed Strategy](#seed-data-strategy-important-nuance) below | CONFIRMED |
| P3 | Build cadence | One continuous build; I'll surface progress and stop only for genuine blockers | CONFIRMED |

## Architecture decisions (Round 2)

| # | Decision | Chosen | Status |
|---|---|---|---|
| A1 | LLM provider(s) | **Gemini + Groq combo** (see split of responsibilities below) | CONFIRMED |
| A2 | Auth / DB / Storage | **Supabase** (Postgres + pgvector + Auth w/ RLS + Storage) | CONFIRMED |
| A3 | Background job infrastructure | **Postgres-native queue** (no Redis) | CONFIRMED |
| A4 | Document processing / OCR | **Gemini-native vision + light local extraction** (pypdf/pdfplumber primary) | CONFIRMED |

## Technology decisions (Round 3 — final stack confirmation)

| # | Decision | Chosen | Status |
|---|---|---|---|
| T1 | Backend language/framework | **Node.js + Express + TypeScript** (moved off the Python/FastAPI default) | CONFIRMED |
| T2 | Frontend framework | **React (Vite) + TypeScript**, plain SPA (moved off the Next.js default) | CONFIRMED |
| T3 | Retrieval implementation | **Custom lightweight** (pgvector similarity + manual prompt assembly), no LangChain/LlamaIndex | CONFIRMED (reaffirms D9) |
| T4 | Backend + worker host | **Render or Railway** (either is fine — pick one at setup time); **Vercel is frontend-only** | CONFIRMED |

**Why Express over NestJS:** NestJS's decorator/DI system would enforce our module boundaries automatically, but Express with the same router → service → repository folder discipline reaches the same boundaries with less framework ceremony to learn in a 3-4 day window — chosen for build speed.

**Why React (Vite) over Next.js:** Not because of the two-host deployment (a Next.js frontend calling a separate Express API on another host is a common, easy pattern — that reasoning doesn't actually hold). The real justification: this entire product sits behind authentication with no public/SEO-facing pages, so none of Next.js's headline features (SSR, ISR, file-based server routing) would actually be used here. A plain Vite+React SPA is simpler, lighter, and deploys just as easily as static files — so we get the same outcome with less framework surface.

**Why Vercel could not also host the backend:** verified against current Vercel docs — serverless functions have no persistent-process mode, and the free Hobby plan caps Cron jobs at once per day (Pro removes this but costs $20/mo). The PRD's background-processing requirement (continuous retry/recovery for material processing and learning workflows) needs an always-on worker, which Render/Railway provide directly and Vercel structurally cannot on the free tier. Source: [Vercel Limits](https://vercel.com/docs/limits), [Background Jobs on Vercel in 2026](https://dev.to/ahmed_mahmoud360/background-jobs-on-vercel-in-2026-field-notes-on-waituntil-queues-workflow-and-cron-1l6g).

### Cascading implementation-detail swaps (follow directly from T1/T2, not independent decisions)

| Concern | Python-era default | Node-era equivalent |
|---|---|---|
| Backend framework | FastAPI | **Express** |
| Background job library | Procrastinate | **pg-boss** (same Postgres-native, no-Redis approach — see D13) |
| PDF text extraction | pypdf/pdfplumber | **pdfjs-dist** (pure JS, no external binary dependency — simpler to deploy on Render) |
| DB access | SQLAlchemy | **Drizzle ORM**, with raw SQL escape hatches for the pgvector cosine-distance queries |
| Request validation | Pydantic | **Zod** |
| Client-side routing | Next.js file-based router | **React Router** |
| API docs | FastAPI auto OpenAPI | Hand-maintained OpenAPI/README endpoint reference, or `zod-to-openapi` if time allows |

## Decisions made on your behalf (proposed defaults — please review)

| # | Decision | Chosen default | Why | Alternative if you push back |
|---|---|---|---|---|
| D3 | Repo layout | **Monorepo, two top-level app folders** (`apps/web`, `apps/api`), no Turborepo/Nx | A build-tool monorepo earns its cost only once you share packages across apps — not the case here in 3-4 days | Two separate repos (adds cross-repo coordination overhead for no benefit at this scale) |
| D4 | Backend internal structure | **Modular monolith**: one Express app, split into domain modules (`learning`, `materials`, `ai`, `assessment`, `analytics`, `admin`), each with router → service → repository → schema layers | Microservices are explicitly overkill for 3-4 days (PRD says so implicitly via timebox); modular monolith still gives clean separation of responsibilities the PRD asks for, with a straightforward path to splitting services later if ever needed | N/A — this is close to a hard requirement given the timebox |
| D5 | Vector storage | **pgvector inside the same Supabase Postgres DB** | One database for relational + vector data; ACID-consistent with ownership/isolation checks; dedicated vector DBs only pay off past millions of vectors, far beyond prototype scale | Qdrant Cloud free tier (adds a second system to keep in sync for no real benefit here) |
| D6 | Deployment targets | **Vercel** (frontend, static React build) + **Render or Railway** (Express backend + pg-boss worker process) + **Supabase** (DB/Auth/Storage) | See T4 above | Fly.io (comparable, slightly more DevOps to hand-roll) |
| D7 | AI provider split | **Gemini**: Tutor RAG chat, document understanding (vision OCR fallback), embeddings, open-ended assessment grading/feedback, recommendation generation, LLM-as-judge evaluation.<br>**Groq** (`openai/gpt-oss-120b` — Llama 3.3 70B was the original pick but was retired from Groq's catalog; swapped after verifying availability + structured-output support directly against `GET /openai/v1/models`): adaptive quiz **question generation**, where low latency matters more than maximal reasoning depth and structured MCQ output is a good fit for open-weight models. | Groq's free tier only serves open-weight models (no native PDF vision, weaker grounded-citation reliability) — best used where speed matters and stakes are lower than Tutor grounding; Gemini stays responsible for every task where citation accuracy/groundedness is scored | Route everything through Gemini alone if the two-provider split proves not worth the added observability/testing surface |
| D8 | AI access pattern | A thin internal `ai_provider` interface (`generate_text`, `generate_structured`, `embed`, `understand_document`) with `GeminiProvider` and `GroqProvider` implementations behind it | Directly satisfies the PRD's "Should Have: provider abstraction" and keeps provider-specific code out of business logic — cheap to build in, expensive to retrofit later | Call SDKs directly from each service (faster to write, harder to test/observe/swap later) |
| D9 | Retrieval implementation | **Lightweight custom retrieval** (page-aware chunking → Gemini embeddings → pgvector cosine similarity → manual prompt assembly), not LangChain/LlamaIndex/Haystack | A full framework's abstraction layer works against the PRD's explicit "Observable AI" principle — we need to reason precisely about exactly what context reached the model; a framework also adds a non-trivial learning/debugging cost inside a 3-4 day window | LlamaIndex node parsers used piecemeal for chunking only, without adopting the full framework |
| D10 | Chunking strategy | **Page-aware chunking**: every chunk stores its source page number(s) as metadata at creation time, ~10-15% overlap | Simpler and more reliable path to accurate page citations than pure semantic chunking, which can lose page boundaries | N/A |
| D11 | Groundedness / anti-hallucination pattern | Two-layer gate: (1) cheap pre-check — if top-k retrieval similarity scores fall below a threshold, skip generation and return the "insufficient evidence" branch immediately; (2) the model's structured output **must** include a `citations[]` field, and the app validates every citation against the actual retrieved chunk IDs before rendering — a citation that doesn't match a real chunk is stripped and treated as ungrounded | Prevents "citation-shaped hallucination" (answers that look grounded but aren't) — the retrieval score alone isn't enough, so we verify at the output layer too. Directly implements PRD §7's `Enough Evidence? → YES/NO` branch as literal code, not a prompting hope | N/A — this is close to a hard requirement given PRD §7 is called a "core evaluation requirement" |
| D12 | Mastery / adaptive algorithm | **Weighted-evidence heuristic** (exponential moving average per concept, weighted by question difficulty and evidence recency — not Bayesian Knowledge Tracing or IRT) | BKT/IRT need meaningful interaction history to fit reliable parameters — a brand-new prototype user has none (cold-start problem). The EMA heuristic is continuous (not the forbidden wrong→easy/correct→hard ladder), explainable in a demo video, and buildable in about a day. Documented explicitly as a deliberate simplification, with BKT/IRT named as a concrete future improvement once real interaction volume exists | Full BKT per concept (more "textbook," materially more implementation risk in this timebox) |
| D13 | Background job library | **pg-boss** (Postgres-native async task queue for Node: uses `LISTEN/NOTIFY` + `SKIP LOCKED`, built-in retries/backoff) | Matches decision A3 (no Redis) with a maintained library instead of hand-rolling a polling worker from scratch | Hand-rolled polling table + worker loop if pg-boss causes integration friction |
| D14 | Observability | **Own `ai_usage_log` / `event` Postgres tables as the source of truth** (feeds the Admin Dashboard directly) + **Langfuse Cloud free tier** layered on top for rich trace-level debugging ("why was this slow," full prompt/response inspection) | The Admin Dashboard must work even if a third-party tool is unavailable/misconfigured, so first-party logging is the durable source of truth; Langfuse adds a much better debugging UI for near-zero setup cost (no self-hosted ClickHouse/Redis stack) | Self-hosted Langfuse (heavier infra, not worth it at this scale) |
| D15 | Evaluation approach | A small **golden test-case set** (~10-20 cases covering grounded answers, unsupported questions, MCQ + open-ended grading, recommendations) scored by an **LLM-as-judge** pass, plus **deterministic checks** where possible (e.g., does a cited page number actually exist in that material) | Realistic to build in the timebox; deterministic checks are cheap and more trustworthy than LLM judgment for simple factual correctness; re-run manually whenever a prompt/model/retrieval parameter changes, to demonstrate regression-awareness | Full CI-gated eval suite (explicitly a "Should Have," not Day-1) |
| D16 | Authorization pattern | **Defense in depth**: an Express middleware verifies the Supabase-issued JWT on every request, extracts `user_id`, and every service-layer query is explicitly scoped (`WHERE owner_id = :user_id`); Postgres **Row-Level Security is also enabled** on every user-owned table as a second line of defense | The PRD calls data isolation a "core requirement," not a nice-to-have — one layer of enforcement is a single point of failure; two independent layers catch each other's bugs | RLS-only (simpler, but leaves the Express layer with no explicit authorization logic to point to when asked "how do you enforce isolation?") |
| D17 | Streaming Tutor citation-validation tradeoff | The streaming Tutor endpoint (`POST .../tutor/messages/stream`, M8+) forwards prose tokens to the client as they arrive, *before* the model's trailing citation JSON has been seen or validated. If validation later finds zero valid citations, the app does **not** retroactively hide the already-streamed prose (impossible to un-render tokens the user already read) — it instead appends a distinct `notice`/`groundingUncertain: true` signal and persists the message with empty citations. This deliberately weakens D11's original guarantee ("never show an answer without app-validated grounding") for the streaming path only | Token-level streaming and D11's atomic pre-generation-complete validation are fundamentally in tension — one requires showing text before the full response exists, the other requires validating the full response before showing any of it. The non-streaming `handleTutorMessage()` endpoint is untouched and keeps D11's original guarantee exactly; `scripts/runEval.ts` evaluates against that unchanged path | "Fake" streaming — buffer the full answer server-side, validate it exactly as today, then chunk it out to the client after the fact purely for visual effect. Rejected: it keeps D11's guarantee intact but delivers none of streaming's actual benefit (perceived first-token latency), since the user still waits the full generation time before anything appears |
| D18 | Caching layer (M11) | **In-process, `Map`-based TTL cache** (`apps/api/src/core/cache.ts`'s `withCache(key, ttlMs, fn)`), no write-path invalidation — applied to the dashboard-aggregate reads in `analytics/repository.ts` and `admin/repository.ts` (30s TTL), explicitly excluding `assessment/repository.ts` (Growth's post-quiz mastery read must stay real-time) and Admin's System Health checks (`getLastProcessedJobAt`/`getRecentAiSuccessRate` — worker/AI-provider staleness must stay real-time) and the paginated admin browsing lists (`listUsers`/`listAllSpaces`/`listAllProjectsAdmin`/`listActivity` — an admin acting then checking the list expects to see the result immediately). Every project/owner-scoped key embeds that scoping ID (e.g. `` `analytics:eventCounts:${projectId}` ``); platform-wide admin keys are fixed, since `requireAdmin` gates the whole query with no per-caller variance | Matches this project's existing Postgres-native precedent (A3/D13, no Redis) rather than introducing new infra to deploy; every cached target here is a read-only dashboard aggregate the user re-visits, not a live-updating view, so bounded ≤30s staleness is an acceptable, self-contained tradeoff | Redis (real infra to deploy/monitor for a prototype-scale win); no caching at all (simpler, but repeated dashboard tab-switches re-run the same aggregation queries for no reason) |

---

## Seed Data Strategy (important nuance)

Your instruction: *"none of them should be hardcoded... if one thing updates or changes all the related ones... should be updated... this seed should help so that we can also know any errors in the code."*

This is implemented as: **the seed script is not a SQL fixture — it is a script that calls the exact same service-layer functions the real application uses** (`createSpace()`, `createProject()`, `uploadAndProcessMaterial()`, `simulateQuizAttempt()`, `runMasteryUpdate()`, etc.), the same way a real user's actions would. Consequences:

- Seeded data is always internally consistent, because it's produced by the same code paths that enforce consistency for real users — there is no separate "seed truth" that can drift from "app truth."
- If a service function's behavior changes (e.g., mastery calculation logic changes), re-running the seed script immediately reflects that change everywhere it should — a Concept's mastery bar, its Growth trend, and any Recommendation derived from it update together, because they all come from the same underlying write path.
- Because it exercises upload → background processing → quiz → grading → mastery update → recommendation generation end-to-end, the seed script doubles as a **smoke test** — if any part of that pipeline breaks, seeding fails loudly instead of silently producing stale/incorrect demo data.
- The script is **idempotent** (safe to re-run — it upserts/skips already-seeded demo users rather than duplicating them) and is a first-class part of the repo (`apps/api/scripts/seed.ts`), documented in the README.
