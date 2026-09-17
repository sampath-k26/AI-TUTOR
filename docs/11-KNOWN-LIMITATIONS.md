# Known Limitations

Honest disclosure per submission requirement §18.8, organized by the categories the PRD asks for. Several of these were *found live* while building (not guessed) — where that's true, it's noted.

## AI

- **Gemini's free tier has a real daily cap** (20 requests/day for `gemini-3.6-flash`, separate from its per-minute cap) that a single active development/testing session can exhaust — this happened live while building M5/M6 and is documented in `CLAUDE.md` and `08-EVALUATION.md`. `withRetry()` detects this specific case and fails fast rather than wasting retries, but there is no fallback provider or paid-tier upgrade path wired in.
- Open-ended grading, recommendation generation, and learning plan generation (M13) are each a single LLM call with schema validation, not a secondary judge/verification pass (a deliberate prototype-scope tradeoff — decision D15). For learning plans specifically, the model's chosen `type`/`description` wording isn't independently verified — only the `relatedMaterialId`/`relatedConceptId` it returns are checked against the Project's real materials/concepts, with a hallucinated id dropped to null rather than stored.
- Streaming Tutor responses (M8+, decision D17) weaken D11's "never show an answer without validated grounding" guarantee for that path specifically: prose streams to the client before its trailing citations are seen, so a post-hoc grounding failure is flagged (a `groundingUncertain` notice) rather than pre-emptively hidden. The non-streaming endpoint (still used by `runEval.ts`) is unaffected.
- Provider model names can be deprecated without notice — this happened twice during the build (`gemini-2.5-flash`, `llama-3.3-70b-versatile`), each caught via a live 404 and the app's own `ai_usage_log.error_detail`. There's no automated alert for a model going stale; it will surface the same way in production.

## Retrieval

- Retrieval is deliberately lightweight (decision D9): pgvector cosine similarity over page-aware chunks, no re-ranking step, no hybrid (keyword + vector) search, no query rewriting.
- Chunking prefers a sentence boundary near its target size (M8+) but is still not paragraph- or table-aware — a chunk can still split a table across two chunks, and the upstream whitespace-collapse step means paragraph breaks aren't preserved as a boundary signal.
- The concept map's edges (M12, decision D19) are a coarse proxy for true semantic relationship — two concepts "co-occur" only when their names both literally appear (case-insensitive substring) in the same chunk, so a well-organized document whose sections each cover one concept in isolation (verified live against this project's own `cell_biology.pdf` fixture) can legitimately show few or no edges even though the concepts are related.

## Documents

- PDF only. No `.docx`/`.pptx`/image uploads.
- Vision fallback (for scanned/low-text-density pages) batches up to 4 flagged pages per Gemini call (M8+), reducing but not eliminating cost/latency scaling with page count; a page whose delimiter the model fails to echo back in a multi-page batch keeps its original (poor) extracted text rather than losing it, but is still not vision-corrected.
- A material is processed as a single background job with no partial-progress reporting beyond the four coarse statuses (`queued`/`processing`/`ready`/`failed`) — a very large PDF gives no finer-grained feedback while it processes.

## Scaling

- Single Postgres instance (Supabase) serves both relational data and the pgvector index (decision D5, explicitly accepted at prototype scale) — no dedicated vector store or read replica.
- pg-boss workers scale by running more worker processes against the same database; there's no documented autoscaling strategy.
- The in-process cache (M11, decision D18) is per-process and cold after every deploy/restart — no shared cache across multiple horizontally-scaled instances, and it is TTL-only with no write-path invalidation (bounded ≤30s staleness on dashboard aggregates is an accepted tradeoff, not a bug). Retrieval itself (pgvector similarity search) is not cached — a deliberate exclusion, since Tutor/quiz-generation grounding must stay real-time.

## Security

- The `vector` Postgres extension is installed in the `public` schema rather than a dedicated schema — a Supabase linter hygiene warning, not an exploitable issue (see `07-SECURITY-PASS.md` §3); left as-is to avoid a risky live-schema migration for a cosmetic fix.
- Leaked-password protection is not enabled on the Supabase Auth project — a one-click dashboard toggle outside the app's own code, not currently turned on.
- The `generateRecommendation` background job is not fully idempotent under pg-boss's at-least-once redelivery — a narrow failure window (a crash between the Gemini call succeeding and the DB write) could in principle produce a duplicate recommendation. Accepted rather than building request-level idempotency-key infrastructure for a prototype (`07-SECURITY-PASS.md` §5). Material-chunk insertion and quiz-answer submission, which had the same exposure and a more visible consequence (duplicated Tutor grounding context; duplicated mastery updates from a live concurrent-request test — see `docs/testing/TEST-REPORT.md`'s security pass), were both fixed — `responses.question_id` is now unique with an idempotent resubmission path in `submitAnswer`.
- `events.dedupe_key` exists in the schema (unique, nullable) as a designed idempotency guard but no current write path populates it — background-job-emitted events could in principle duplicate under redelivery for the same reason above.
- No application-level rate limiting on the Express API — the practical backstop today is each AI provider's own quota. A security pass live-verified this is a real gap (no throttling stopped rapid repeated calls) but is otherwise unchanged from the accepted prototype-scope tradeoff already noted here.

## Cost

- Both AI providers run on free tiers with real, sometimes-tight quotas (see AI section above) — there's no cost-based routing, budget alerting, or per-user/per-project cost cap beyond `ai_usage_log.estimated_cost_usd` being visible in the Admin Dashboard.

## UI

- No dedicated mobile layout pass beyond Tailwind's responsive utilities applied ad hoc per component and the sidebar's own mobile drawer.
- Activity/analytics lists aren't paginated on the frontend yet — fine at prototype data volumes, would need it at real scale.

## Background processing

- Concept insertion during material processing is deduplicated at the AI-prompt level (existing concept names are passed into the extraction prompt) rather than enforced by a hard DB constraint — a pragmatic, not perfect, mitigation against a redelivered job creating duplicate concepts.
- The Admin Dashboard's "recent failed jobs" view is read-only (raw job output) — there's no retry-from-UI action; retries currently only happen via pg-boss's own automatic retry policy (`retryLimit: 3`).

## Future improvements

Tracked as M8-M13 in `06-IMPLEMENTATION-PLAN.md`, all complete. M8: rich document understanding. M9: streaming Tutor responses. M10: improved analytics (day-bucketed mastery/AI-usage/engagement time-series charts, hand-rolled zero-dependency SVG per the dataviz skill's validated palette). M11: an in-process caching layer for analytics/admin dashboard aggregates (decision D18). M12: a live heuristic concept map (decision D19 — circular-layout SVG, edges from substring co-occurrence, optionally colored by growth trend). M13: AI-generated, regenerable learning plans (a checklist of concrete next steps, with each `relatedMaterialId`/`relatedConceptId` the model returns validated against the Project's real materials/concepts before being persisted — a hallucinated id is dropped to null rather than stored).
