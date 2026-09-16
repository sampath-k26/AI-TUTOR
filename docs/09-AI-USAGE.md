# AI Usage Disclosure

Per the submission requirements (`01-REQUIREMENTS-MAP.md` §18.5), distinguishing AI used *to build* this product from AI used *by* this product.

## AI used to build the product

The entire codebase — planning docs, schema, every backend module, the frontend, tests, the seed script, the eval harness, this documentation — was built using **Claude Code** (Anthropic's agentic CLI, running Claude Sonnet 5), operating as a development agent across several sessions with a human directing product decisions and reviewing the result. Concretely, the agent:

- Read the 25-page PRD and produced the full planning suite (`01-REQUIREMENTS-MAP.md` through `06-IMPLEMENTATION-PLAN.md`) before writing any code, per the human's explicit instruction to plan first and surface every non-trivial decision rather than assume one.
- Implemented every milestone (M0–M6) incrementally with git commits at each logical step, following the module-boundary and Node-version rules recorded in `CLAUDE.md`.
- Used the Supabase MCP tools and direct API calls for **live verification**, not just code review: created and tore down real test users, ran real HTTP requests against the running API, queried the live Postgres database directly to diagnose failures (e.g., reading `ai_usage_log.error_detail` to discover a deprecated Gemini model name, and later a live 429 response body to discover Gemini's daily quota mechanics), and used a real browser session (via a Chrome automation tool) to visually verify every UI surface before calling it done.
- Found and fixed real bugs this way that a code-only review would have missed: a JWT-verification method that was wrong for Supabase's current signing-key scheme, a missing WebSocket polyfill that only threw at runtime on Node 20, two deprecated AI model names, a missing retry/backoff layer surfaced by a real transient 503, an under-provisioned retry backoff surfaced by a real 429, several module-boundary violations, and a background-job idempotency gap that would have silently duplicated Tutor grounding context.
- Wrote and ran the automated test suite (77+ backend unit tests, frontend critical-flow tests) and the security pass in `07-SECURITY-PASS.md`, including a live two-user cross-project-isolation attack against the deployed database.

What stayed human-directed throughout: every product/architecture decision with real tradeoffs (LLM provider choice, monolith vs. microservices, framework picks, UI design source, Docker-vs-Supabase pivot) was explicitly surfaced as a question and decided by the human before implementation proceeded — see `02-DECISIONS-LOG.md`, whose entire format exists to keep that decision trail visible. The human also provided all real credentials, reviewed the running application, and set the scope/sequencing (Must-Haves before Should/Nice-to-Haves).

See `10-DEVELOPMENT-LOG.md` for the actual prompts that drove this, organized by area.

## AI used by the product itself

Two providers, behind a shared `aiProvider` interface (`GenerateTextParams`/`GenerateStructuredParams`/`EmbedParams`/`UnderstandDocumentParams` in `apps/api/src/aiProvider/base.ts`) so no module ever calls an SDK directly:

| Provider | Used for | Why this provider |
|---|---|---|
| **Gemini** (`gemini-3.6-flash`, `gemini-embedding-001`) | Tutor RAG chat + citation validation, document understanding (vision OCR fallback for scanned/low-text PDF pages), embeddings for pgvector retrieval, open-ended assessment grading, recommendation generation | Free tier, strong structured-output support (`z.toJSONSchema()`-validated responses), native vision for document understanding — see decision D7 |
| **Groq** (`openai/gpt-oss-120b`) | Adaptive quiz **MCQ generation** only | Fast inference on Groq's free tier is worth more than extra reasoning depth for a bounded-format MCQ; Groq has no embeddings or native document vision in its free tier, so it's never used for grounding-sensitive work |

Every call through `aiProvider` is wrapped in `withRetry()` (exponential backoff on 429/5xx/network errors, fast-fail on Gemini's non-recoverable daily-quota 429 — see `CLAUDE.md`) and logged to `ai_usage_log` (feature, provider, model, latency, tokens, estimated cost, success/error detail) — the Admin Dashboard's source of truth, mirrored to Langfuse Cloud when configured. Both providers are used **only** for the features listed above; no other backend code path calls an AI provider.
