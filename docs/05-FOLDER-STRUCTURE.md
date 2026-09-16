# Repository Folder Structure

Monorepo, two apps, no build-tool orchestration (Turborepo/Nx) — see decision D3. Stack: React (Vite) frontend, Express (Node/TypeScript) backend — see `02-DECISIONS-LOG.md` Round 3.

```
AI-TUTOR/
├── apps/
│   ├── web/                              # React (Vite) + TypeScript frontend
│   │   ├── src/
│   │   │   ├── routes/                   # React Router route components
│   │   │   │   ├── auth/                 # login/signup
│   │   │   │   ├── home/                 # User Home ("where was I / how am I doing / next")
│   │   │   │   ├── spaces/[spaceId]/
│   │   │   │   ├── projects/[projectId]/
│   │   │   │   │   ├── materials/
│   │   │   │   │   ├── tutor/
│   │   │   │   │   ├── quiz/
│   │   │   │   │   ├── growth/
│   │   │   │   │   └── analytics/
│   │   │   │   └── admin/                # Admin Dashboard (role-gated)
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # generic design-system components
│   │   │   │   └── features/             # feature-specific components (TutorChat, QuizCard, MasteryBar, ...)
│   │   │   ├── lib/
│   │   │   │   ├── apiClient.ts          # typed fetch wrapper for the Express backend
│   │   │   │   ├── supabaseClient.ts     # Supabase JS client (auth session only)
│   │   │   │   └── types.ts              # shared response types (mirrors backend Zod schemas)
│   │   │   ├── hooks/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── tests/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── api/                              # Express (Node/TypeScript) backend
│       ├── src/
│       │   ├── main.ts                   # app bootstrap, middleware, router registration
│       │   ├── core/
│       │   │   ├── config.ts             # env/config loading
│       │   │   ├── auth.ts               # Supabase JWT verification middleware
│       │   │   ├── db.ts                 # Drizzle client / Postgres pool
│       │   │   └── observability.ts      # ai_usage_log writer + Langfuse client wrapper
│       │   ├── modules/
│       │   │   ├── learning/             # spaces, projects, dashboards
│       │   │   │   ├── router.ts
│       │   │   │   ├── service.ts
│       │   │   │   ├── repository.ts
│       │   │   │   └── schemas.ts
│       │   │   ├── materials/            # upload, processing status, chunks/knowledge
│       │   │   │   ├── router.ts
│       │   │   │   ├── service.ts
│       │   │   │   ├── repository.ts
│       │   │   │   ├── schemas.ts
│       │   │   │   └── processing/
│       │   │   │       ├── extract.ts        # pdfjs-dist text+page extraction
│       │   │   │       ├── visionFallback.ts # Gemini vision OCR for scanned/complex pages
│       │   │   │       └── chunking.ts       # page-aware chunking
│       │   │   ├── ai/                   # Tutor, RAG, citations, unsupported-question handling
│       │   │   │   ├── router.ts
│       │   │   │   ├── service.ts
│       │   │   │   ├── retrieval.ts      # pgvector similarity query + context composition
│       │   │   │   ├── prompts/          # versioned prompt templates
│       │   │   │   └── schemas.ts
│       │   │   ├── assessment/           # quiz, grading, mastery, growth, recommendations
│       │   │   │   ├── router.ts
│       │   │   │   ├── service.ts
│       │   │   │   ├── selection.ts      # adaptive concept/difficulty selection
│       │   │   │   ├── mastery.ts        # EMA mastery update formula (D12)
│       │   │   │   ├── repository.ts
│       │   │   │   └── schemas.ts
│       │   │   ├── analytics/
│       │   │   │   ├── router.ts
│       │   │   │   ├── service.ts
│       │   │   │   └── repository.ts
│       │   │   └── admin/
│       │   │       ├── router.ts
│       │   │       ├── service.ts
│       │   │       └── repository.ts
│       │   ├── aiProvider/               # provider abstraction (decision D8)
│       │   │   ├── base.ts               # interface/types
│       │   │   ├── geminiProvider.ts
│       │   │   └── groqProvider.ts
│       │   └── workers/                  # pg-boss job definitions
│       │       ├── bossClient.ts         # pg-boss instance/config
│       │       ├── processMaterial.ts
│       │       ├── evaluateAndUpdateMastery.ts
│       │       ├── detectWeakness.ts
│       │       └── generateRecommendation.ts
│       ├── db/
│       │   ├── schema.ts                 # Drizzle schema definitions
│       │   └── migrations/               # Drizzle Kit migrations
│       ├── scripts/
│       │   ├── seed.ts                   # service-layer-driven seed script (see decisions log)
│       │   └── runEval.ts                # golden-set evaluation runner
│       ├── eval/
│       │   └── cases/                    # golden test cases (json)
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── setup.ts
│       ├── tsconfig.json
│       └── package.json
│
├── db/
│   └── schema.sql                        # canonical reference schema (mirrors Drizzle schema)
│
├── docs/                                 # this planning documentation
│   ├── 01-REQUIREMENTS-MAP.md
│   ├── 02-DECISIONS-LOG.md
│   ├── 03-ARCHITECTURE.md
│   ├── 04-DATA-MODEL.md
│   ├── 05-FOLDER-STRUCTURE.md
│   ├── 06-IMPLEMENTATION-PLAN.md
│   └── ai-usage/                         # final-submission AI-usage docs, dev prompts, eval write-up
│
├── .env.example
├── README.md
└── package.json                          # workspace root (npm/pnpm workspaces linking apps/web + apps/api)
```

**Boundary rule enforced throughout:** a module's `repository.ts` is the only file allowed to run SQL/Drizzle queries for that module's tables; other modules call its `service.ts` exports, never its repository directly. Express has no built-in mechanism to enforce this (unlike NestJS's DI), so it's a documented convention checked in code review/lint rules (e.g., an ESLint import-boundary rule restricting cross-module imports to `service.ts` files only) — this is what keeps "modular monolith" from silently becoming a tangled monolith.
