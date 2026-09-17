# Data Model

Postgres (Supabase), refined from the cross-reference table in `01-REQUIREMENTS-MAP.md`. Types are indicative (Postgres/SQL), not final DDL. All tables listed under "user-owned" get a Row-Level Security policy per `03-ARCHITECTURE.md` §7.

## Entity relationship overview

```
users (Supabase auth.users + profile)
 └─< spaces
      └─< projects
           ├─< materials
           │    └─< material_chunks (embedding vector)
           ├─< concepts
           │    ├─< mastery  (1:1 per project+concept)
           │    └─< growth_snapshots (append-only history)
           ├─< conversations
           │    └─< messages (+ citations jsonb)
           ├─< quizzes
           │    └─< questions
           │         └─< responses
           ├─< recommendations
           └─< learning_context  (goals/strengths/weaknesses/preferences/mistakes)
 events (activity log, references user_id + optional project_id)
 background_jobs (pg-boss-managed table)
 ai_usage_log
 eval_result
```

## Core tables

### `profiles` (extends `auth.users`)
| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| email | text | |
| role | text | `user` \| `admin`, default `user` |
| created_at | timestamptz | |

### `spaces` (user-owned)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK → profiles | RLS scope |
| name | text | required |
| description | text | required |
| theme | jsonb | optional visual customization |
| created_at, updated_at | timestamptz | |

### `projects` (user-owned via space)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| space_id | uuid FK → spaces | |
| owner_id | uuid FK → profiles | denormalized for direct RLS/query without a join |
| name, description, learning_goal | text | required at creation |
| status | text | `active` \| `archived` |
| created_at, updated_at | timestamptz | |

### `materials`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | |
| file_path | text | Supabase Storage path |
| original_filename | text | |
| status | text | `queued`\|`processing`\|`ready`\|`failed` |
| page_count | int | |
| error_detail | text nullable | populated on failure |
| created_at, processed_at | timestamptz | |

### `material_chunks`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| material_id | uuid FK | |
| project_id | uuid | denormalized for retrieval query scoping |
| page_number | int | required — powers citations |
| content | text | |
| embedding | vector(768) | pgvector; dimension per Gemini embedding model |
| created_at | timestamptz | |

Index: `ivfflat` (or `hnsw`) on `embedding`, plus a btree on `project_id` so similarity search is always pre-filtered by project (data isolation at the query layer, not just RLS).

### `concepts`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | |
| name | text | |
| description | text | |
| source_material_ids | uuid[] | which materials this concept was derived from |
| created_at | timestamptz | |

### `mastery` (current state, 1 row per project+concept)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| project_id, concept_id | uuid FK | unique together |
| level | numeric(5,2) | 0-100 |
| confidence | numeric(3,2) | widens/narrows with evidence volume |
| evidence_count | int | |
| last_evidence_at | timestamptz | powers recency decay |
| updated_at | timestamptz | |

### `growth_snapshots` (append-only history, powers Growth Analysis trend)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| project_id, concept_id | uuid FK | |
| level | numeric(5,2) | mastery value at this point in time |
| trend | text | `improving`\|`stable`\|`requires_attention` (computed at write time) |
| evidence_ref | jsonb | pointer to the response/event that caused this snapshot |
| created_at | timestamptz | |

### `conversations` / `messages`
| table | key columns |
|---|---|
| `conversations` | id, project_id, title, created_at |
| `messages` | id, conversation_id, role (`user`\|`assistant`), content, citations jsonb (`[{material_id, page}]`), confidence numeric, model text, tokens_in/out int, latency_ms int, created_at |

### `quizzes` / `questions` / `responses`
| table | key columns |
|---|---|
| `quizzes` | id, project_id, status (`in_progress`\|`completed`), started_at, completed_at |
| `questions` | id, quiz_id, concept_id, type (`mcq`\|`open_ended`), difficulty, prompt, options jsonb (mcq only), answer_key jsonb, generated_by (`gemini`\|`groq`) |
| `responses` | id, question_id, user_answer text, is_correct bool nullable (mcq), evaluation jsonb (`{understanding, accuracy, key_concepts_covered, missing_concepts, feedback_text}`), score numeric, created_at |

### `recommendations`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | |
| text | text | user-facing recommendation |
| rationale | jsonb | which weaknesses/mistakes/goals drove this |
| status | text | `active`\|`dismissed`\|`completed` |
| created_at | timestamptz | |

### `learning_plans` (M13)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK, cascade | |
| status | text | `active`\|`archived` — regenerating archives the previous active plan rather than deleting it |
| rationale | jsonb | e.g. `{weakConcepts: string[], materialCount: number}` — what drove this plan's steps |
| created_at | timestamptz | |

### `learning_plan_steps` (M13)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| plan_id | uuid FK, cascade | |
| order_index | int | display/execution order within the plan |
| type | text | `material`\|`tutor`\|`quiz`\|`other` |
| description | text | a specific, actionable instruction, not vague encouragement |
| related_material_id | uuid FK, **set null** | first `set null` FK in this schema — a step outliving its linked material shouldn't disappear |
| related_concept_id | uuid FK, **set null** | same reasoning, for a linked concept |
| completed | bool | |
| completed_at | timestamptz nullable | |

### `learning_context`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | |
| type | text | `goal`\|`preference`\|`strength`\|`weakness`\|`mistake`\|`tutor_note` |
| content | text | |
| relevance_score | numeric | decays over time, used to select what's "relevant" per PRD §9 |
| created_at, last_reinforced_at | timestamptz | |

### `events` (activity log — powers analytics + triggers workflows)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| project_id | uuid nullable | |
| type | text | `project_created`\|`material_uploaded`\|`material_processed`\|`tutor_message`\|`quiz_attempt`\|`question_answered`\|`assessment_completed`\|`mastery_updated`\|`recommendation_generated`\|... |
| payload | jsonb | |
| dedupe_key | text unique nullable | idempotency guard for at-least-once delivery |
| created_at | timestamptz | |

### `ai_usage_log`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| feature | text | `tutor`\|`quiz_generation`\|`grading`\|`recommendation`\|`document_understanding`\|`embedding`\|`eval`\|`learning_plan` |
| provider, model | text | e.g. `gemini`, `gemini-3.6-flash` |
| latency_ms | int | |
| tokens_in, tokens_out | int | |
| estimated_cost_usd | numeric(10,6) | |
| success | bool | |
| error_detail | text nullable | |
| related_entity | jsonb | e.g. `{project_id, conversation_id}` for drill-down |
| created_at | timestamptz | |

### `eval_result`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| suite | text | e.g. `tutor_groundedness`, `quiz_grading` |
| case_id | text | |
| verdict | text | pass/fail or score bucket |
| score | numeric nullable | |
| notes | text | |
| model_snapshot | text | which prompt/model version this ran against — enables regression comparison |
| created_at | timestamptz | |

### `background_jobs`
Managed by pg-boss's own schema (job table with status, args, retry count, scheduled_at) — not hand-modeled; documented here only for completeness of the ER diagram.

---

## Notes on isolation enforcement

Every table above that hangs off `project_id` gets:
1. A **service-layer filter**: every repository query includes `WHERE project_id = :project_id AND project.owner_id = :user_id` (via join or denormalized `owner_id`).
2. A **Postgres RLS policy**: `USING (owner_id = auth.uid())` (directly or via a `project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())` subquery for child tables).

This satisfies decision D16 (defense in depth) concretely at the schema level.
