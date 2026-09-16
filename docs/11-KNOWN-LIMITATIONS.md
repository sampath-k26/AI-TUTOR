# Known Limitations

Honest disclosure per submission requirement §18.8, organized by the categories the PRD asks for. Several of these were *found live* while building (not guessed) — where that's true, it's noted.

## AI

- **Gemini's free tier has a real daily cap** (20 requests/day for `gemini-3.6-flash`, separate from its per-minute cap) that a single active development/testing session can exhaust — this happened live while building M5/M6 and is documented in `CLAUDE.md` and `08-EVALUATION.md`. `withRetry()` detects this specific case and fails fast rather than wasting retries, but there is no fallback provider or paid-tier upgrade path wired in.
- No streaming Tutor responses yet — the Must-Have scope is request/response; streaming is an explicit M8+ item.
- Open-ended grading and recommendation generation are each a single LLM call with schema validation, not a secondary judge/verification pass (a deliberate prototype-scope tradeoff — decision D15).
- Provider model names can be deprecated without notice — this happened twice during the build (`gemini-2.5-flash`, `llama-3.3-70b-versatile`), each caught via a live 404 and the app's own `ai_usage_log.error_detail`. There's no automated alert for a model going stale; it will surface the same way in production.

## Retrieval

- Retrieval is deliberately lightweight (decision D9): pgvector cosine similarity over page-aware chunks, no re-ranking step, no hybrid (keyword + vector) search, no query rewriting.
- Chunking uses fixed-size overlap, not semantic or structure-aware boundaries — a chunk can split a sentence or table across two chunks.

## Documents

- PDF only. No `.docx`/`.pptx`/image uploads.
- Vision fallback (for scanned/low-text-density pages) runs one page at a time — no batching, so a heavily-scanned document costs proportionally more latency and AI calls.
- A material is processed as a single background job with no partial-progress reporting beyond the four coarse statuses (`queued`/`processing`/`ready`/`failed`) — a very large PDF gives no finer-grained feedback while it processes.

## Scaling

- Single Postgres instance (Supabase) serves both relational data and the pgvector index (decision D5, explicitly accepted at prototype scale) — no dedicated vector store or read replica.
- pg-boss workers scale by running more worker processes against the same database; there's no documented autoscaling strategy.
- No caching layer for repeated retrieval or analytics queries — an explicit M8+ item.

## Security

- The `vector` Postgres extension is installed in the `public` schema rather than a dedicated schema — a Supabase linter hygiene warning, not an exploitable issue (see `07-SECURITY-PASS.md` §3); left as-is to avoid a risky live-schema migration for a cosmetic fix.
- Leaked-password protection is not enabled on the Supabase Auth project — a one-click dashboard toggle outside the app's own code, not currently turned on.
- The `generateRecommendation` background job is not fully idempotent under pg-boss's at-least-once redelivery — a narrow failure window (a crash between the Gemini call succeeding and the DB write) could in principle produce a duplicate recommendation. Accepted rather than building request-level idempotency-key infrastructure for a prototype (`07-SECURITY-PASS.md` §5). Material-chunk insertion, which had the same exposure and a more visible consequence (duplicated Tutor grounding context), was fixed.
- `events.dedupe_key` exists in the schema (unique, nullable) as a designed idempotency guard but no current write path populates it — background-job-emitted events could in principle duplicate under redelivery for the same reason above.
- No application-level rate limiting on the Express API — the practical backstop today is each AI provider's own quota.

## Cost

- Both AI providers run on free tiers with real, sometimes-tight quotas (see AI section above) — there's no cost-based routing, budget alerting, or per-user/per-project cost cap beyond `ai_usage_log.estimated_cost_usd` being visible in the Admin Dashboard.

## UI

- No dedicated mobile layout pass beyond Tailwind's responsive utilities applied ad hoc per component and the sidebar's own mobile drawer.
- Activity/analytics lists aren't paginated on the frontend yet — fine at prototype data volumes, would need it at real scale.

## Background processing

- Concept insertion during material processing is deduplicated at the AI-prompt level (existing concept names are passed into the extraction prompt) rather than enforced by a hard DB constraint — a pragmatic, not perfect, mitigation against a redelivered job creating duplicate concepts.
- The Admin Dashboard's "recent failed jobs" view is read-only (raw job output) — there's no retry-from-UI action; retries currently only happen via pg-boss's own automatic retry policy (`retryLimit: 3`).

## Future improvements

Tracked as M8+ in `06-IMPLEMENTATION-PLAN.md`: streaming Tutor responses (SSE), a caching layer for repeated retrieval/analytics queries, persistent Tutor continuity refinements, automated regression evaluation (running `runEval.ts` in CI), and one signature creative feature chosen based on remaining time (concept map visualization, spaced-repetition scheduling, or similar — PRD §21).
