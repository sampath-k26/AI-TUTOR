# AI Study Companion — Requirements Map

Source: `Project_Requirements.pdf` (v3.0 — Candidate Challenge Edition). This document restates the PRD as a structured requirements map so nothing gets lost before implementation planning begins.

---

## 1. Product Summary

**What it is:** An AI-powered learning workspace that helps a user understand, practice, measure, and continuously improve a skill or knowledge area. It unifies: learning materials, an AI Tutor, adaptive assessment, concept mastery tracking, growth analysis, recommendations, analytics, persistent learning context, and background AI workflows — into one connected product, not a bundle of disconnected AI features.

**Primary learning loop (the product's spine):**
```
Create Space → Create Project → Add Learning Material → Process & Understand Material
→ Learn with AI Tutor → Take Adaptive Quiz → Evaluate Understanding → Update Concept Mastery
→ Analyze Growth → Recommend Next Action → Continue Learning (loop)
```

**The system must continuously answer 3 questions:**
| Question | Evidence source |
|---|---|
| What am I learning? | Spaces, Projects, goals, materials, conversations, concepts |
| How well am I learning it? | Quizzes, assessments, mistakes, Tutor interactions, mastery |
| What should I do next? | Growth, learning history, weaknesses, goals, recent activity |

**Role being evaluated:** Full Stack AI Engineer. Evaluation focuses on **engineering reasoning + implementation quality**, not technology popularity or feature count.

**Timebox:** 3–4 day prototype. Not a commercial platform — a demonstration of full-stack engineering, AI engineering, product thinking, and architectural judgment.

---

## 2. Guiding Principles (govern every design decision below)

1. **Context First** — AI interactions must respect the current Project; no cross-Project leakage.
2. **Evidence Over Guessing** — when evidence is insufficient, the system communicates uncertainty rather than fabricating answers.
3. **Persistent but Relevant Context** — retain useful learning context across sessions, but don't hoard/replay full history.
4. **Asynchronous by Design** — long-running work (processing, indexing, analytics, recommendations, evaluation) runs in the background.
5. **Observable AI** — requests, failures, latency, retrieval, token usage, cost, and eval results must be visible/debuggable.
6. **Safe AI Interaction** — AI touches app functionality only via controlled, validated, permission-aware interfaces, never raw internal access.

---

## 3. Product Structure (entity hierarchy)

```
User
 └── Space (broad learning area; name + description + optional visual customization)
      └── Project (focused learning journey; name + description + learning goal)
           ├── Materials (uploaded docs)
           ├── Knowledge (extracted/derived, searchable representation)
           ├── AI Tutor (conversations)
           ├── Quiz (adaptive assessment)
           ├── Mastery (per-concept estimated mastery)
           ├── Growth (mastery-over-time analysis)
           └── Analytics (project-level)
 └── Global Analytics (aggregates across Spaces/Projects)
```

Each Project owns its own materials, conversations, concepts, assessments, mastery, and activity — isolation is both a UX requirement and a **security/data-isolation requirement**.

### Space
- Required: name, description. Optional: visual customization.
- Space Dashboard: high-level view of its Projects, activity, progress, areas requiring attention.

### Project
- Created with: name, description, learning goal.
- Project Dashboard: overall progress, important concepts, recent activity, learning performance, latest activity, **recommended next step**.
- Navigable flow from dashboard: **Materials → Tutor → Quiz → Growth → Analytics**.

---

## 4. Learning Materials & Knowledge Pipeline

- Upload: **PDF is the primary required format**; additional formats optional/bonus.
- Documents may contain: normal text, tables, images, diagrams, scanned pages (i.e., may require OCR).
- Processing is **asynchronous**, with a visible per-document status: `Queued → Processing/OCR → Content & Structure Extraction → Knowledge Extraction → Search/Retrieval Representation → Ready` (or `Failed`).
- User must be able to see status: queued / processing / ready / failed.
- Processing may produce: chunks, concepts, metadata, relationships, page references, embeddings, or other searchable representations — **exact technique is left open**.
- **Hard requirement:** Tutor and other AI features must be able to retrieve relevant info and **trace it back to its source** (page-level citation).
- Background jobs must support **retry, failure handling, and duplicate-job handling** (idempotency).

---

## 5. AI Tutor (primary learning experience)

- Operates **within the current Project**.
- Must understand: user's goal, Project materials, relevant concepts, previous conversation context, assessment history, important learning context.
- User can: ask questions, ask follow-ups, request simpler explanations, explore concepts, request examples, test understanding, ask for revision guidance.
- Must maintain continuity across sessions **without re-sending full history** to every AI call.
- Context composition model:
  ```
  Current Conversation + Relevant Project Knowledge + Relevant Learning Context → Context-Aware Tutor Response
  ```

### Grounded AI & Citations (hard requirement — core eval criterion)
Request flow:
```
User Question → Understand Request → Identify Project Context → Retrieve Relevant Evidence
→ Generate Answer → Return Supporting Source
```
- Citations must be meaningful, e.g. `Source: Machine Learning Notes — Page 14`, and let the user navigate back to the source.
- **Must NOT fabricate answers when evidence is insufficient.** Required branch:
  ```
  Question → Enough Evidence? → YES → Answer + Citation
                              → NO  → Explain Insufficient Evidence
  ```

---

## 6. AI ↔ Application Interaction (tool-use layer)

The AI layer needs controlled access to app capabilities: search materials, retrieve progress, read assessment history, identify weak concepts, generate quizzes, record learning events, update learning state, generate recommendations.

Required pattern (i.e., function/tool calling with backend enforcement, not free-form access):
```
AI Reasoning → Determine Required Action → Structured Tool/Application Request
→ Backend Validation & Authorization → Execute → Return Result → Continue AI Interaction
```
- AI must **not** have unrestricted DB/internal-service/privileged-operation access.
- AI-generated structured data must be **validated before persisting** or before it changes application state.

---

## 7. Adaptive Quiz & Assessment

- Supports at minimum: **multiple-choice** and **open-ended** questions.
- Question selection must consider: concepts, mastery, previous mistakes, recent performance, difficulty, question history, recent learning activity.
- **Explicit anti-requirement:** must NOT be a naive `wrong→easy / correct→hard` ladder. Must use accumulated evidence to target useful practice areas.
- Flow:
  ```
  Start Quiz → Understand Current Mastery → Select Concept/Difficulty → Generate Question
  → User Answers → Evaluate → Update Mastery → Select Next Question
  ```
- Open-ended grading: AI evaluates understanding, accuracy, relevance, key concepts covered, missing concepts, reasoning quality (where applicable).
- Feedback must explain **what was understood vs. missing**, not just a numeric score.
- Assessment results feed the mastery + growth systems.

---

## 8. Mastery, Growth & Recommendations

- System maintains an **estimated mastery level per important Project concept** (e.g., percentage/bar per concept). Explicitly described as **an estimate, not a perfect measurement** — must evolve with new evidence (quizzes, assessments, learning activity, other interactions).
- **Growth Analysis**: shows how concepts change over time; classifies into **Improving / Stable / Requiring Attention**.
- **Recommendations**: system converts growth insight into a concrete next action, e.g. *"Your understanding of Concept C has improved, but application-based questions remain difficult. Review the related material and complete another short assessment."*
  - Inputs: weaknesses, recent mistakes, goals, recent activity, assessment history, available materials, **previous recommendations** (avoid repeating stale advice).
  - Purpose: answer **"What should I do next?"**

---

## 9. Persistent Learning Context

- Platform maintains a persistent representation of learner context, which **may include**: learning goals, relevant preferences, known strengths, known weaknesses, important learning history, significant Tutor context, assessment history, repeated mistakes.
- Principle: **prioritize relevance over storing everything.**
- On every AI request, the app should retrieve only the context relevant to that task:
  ```
  Current Request → Identify Required Context → { Project | Knowledge | Conversation | Learning | Assessment } → Compose AI Context → Generate Response
  ```
- This persistent, selectively-retrieved context is called out as **the key differentiator** vs. a plain chatbot.

---

## 10. Analytics & Event-Driven Learning

- Meaningful learning events to track: Project creation, material upload/processing, Tutor interactions, quiz attempts, questions answered, assessments completed, mastery updates, recommendations, Project activity.
- Events must support: user-facing activity views, analytics, recommendations, background workflows, admin visibility.
- **Project Analytics:** learning activity, assessment performance, mastery, concept trends, AI activity.
- **Global Analytics:** aggregates activity across Spaces/Projects.
- Event pattern:
  ```
  Application Event → Event Processing → Learning Workflow → Update State → Generate Insight/Recommendation → Analytics
  ```
- Example: a completed Quiz triggers → assessment evaluation → mastery updates → weak-concept detection → recommendation generation.
- Implementation must consider **retries, duplicate events, and idempotency**.

---

## 11. Intelligent Background Workflows

Three named example workflows (minimum set to design for):

**Material workflow:**
`Upload → Process → Extract Concepts → Create Searchable Knowledge → Update Project`

**Learning workflow:**
`Quiz Completed → Evaluate → Update Mastery → Detect Weakness → Generate Insight → Recommend Next Action`

**Repeated-mistake workflow:**
`Repeated Mistake → Identify Pattern → Update Learning Context → Generate Targeted Recommendation`

- System needs reasonable **job states, retries, failure handling, and recovery**.
- User must **not need to keep the browser open** while background work executes.

---

## 12. AI Engineering, Observability & Evaluation

- AI should be engineered as a system, not "just an API call." Abstract, where practical: text generation, structured generation, embeddings/retrieval, evaluation, document understanding.
- Models/providers are open (candidate's choice).
- Must track AI usage: model, feature, latency, token usage, estimated cost, success/failure.
- Must be able to answer investigative questions:
  - Why was an AI response slow? Which model was used? Why did retrieval return poor context? Which AI workflow failed? How much did a request cost? Why did document processing fail?
- **Evaluation must cover:**
  | Area | Criteria |
  |---|---|
  | Tutor | Accuracy, groundedness, citation correctness, unsupported-question handling |
  | Retrieval | Relevance of retrieved content, source quality |
  | Assessment | Question quality, grading quality, structured-output reliability, adaptive behavior |
  | Recommendations | Relevance, actionability, alignment with learner state |
- Evaluation approach is open: curated test cases, automated eval, model-based eval, rule-based checks, or human review.
- Must show awareness that prompt/model/retrieval changes can cause **regressions**.

---

## 13. Reliability, Security & Performance

**Failure handling** (graceful): AI timeouts, provider failures, document-processing failures, retrieval failures, DB errors, invalid AI output, rate limits, background job failures. Use reasonable timeouts, retries, validation, logging, fallback, recovery. **Retried operations must not create duplicate state.**

**Security (core requirement, not optional):**
- Authentication
- Authorization
- Input validation
- Data isolation (users only access their own Spaces/Projects; materials & retrieval isolated; background jobs preserve ownership context; AI capabilities enforce authorization)
- Secure APIs
- Secure document handling
- **AI-specific security**: learning materials and user messages must **not automatically be treated as trusted instructions** — system must distinguish **data vs. instructions vs. application actions**, particularly re: prompt injection / malicious content in uploaded documents or chat.

**Performance** (prototype-appropriate, but should be considered):
- Streaming Tutor responses
- Efficient retrieval
- Pagination
- Caching where useful
- Async work for anything long-running
- Avoid unnecessary AI calls

---

## 14. User & Admin Experience

### User Home (global dashboard)
Must answer at a glance: *"Where was I, how am I doing, and what should I do next?"*
- Continue Learning
- Recent Projects
- Overall progress
- Areas requiring attention
- Recommended next action

### Admin Dashboard
Authorized admins get a platform-level view of: Users, Spaces, Projects, Activity, Engagement, Learning analytics, AI usage, AI evaluation, Background processing, System health.
- Can inspect a single user's learning journey (Projects, activity, assessments, progress, AI usage).
- Can inspect platform-wide activity, filterable by user / Space / Project / activity type / time period.
- Explicitly scoped as a **lightweight operational + product analytics view**, not an infra-monitoring replacement.
- **Implies role-based access control** (user vs. admin) — not explicitly named in PRD but structurally required.

---

## 15. Architecture & Technology (PRD guidance — intentionally open)

Conceptual layering suggested by the PRD (candidate may adapt):
```
Frontend
  ↓
API / Application Layer
  ↓
Business Logic  { Learning | AI | Assessment | Analytics | Admin }
  ↓
Data & Knowledge  { Database | Document Storage | Search/Retrieval | Learning Context }
  ↓
Background Processing
  ↓
AI / External Services
  ↓
Observability
```
- Candidate chooses tech for: frontend, backend, database, auth, document processing, retrieval, AI, background processing, caching, observability, deployment.
- Justify choices against: requirements fit, reliability, dev speed, maintainability, cost, engineering judgment.
- Backend must expose **clean interfaces** for major capabilities, with validation, authorization, error handling, and clear separation of business logic.
- DB must model relationships between: users, Spaces, Projects, materials, conversations, concepts, assessments, mastery, recommendations, activity, AI usage.

---

## 16. Testing, Deployment & Scope

**Testing focus areas** (meaningful coverage, not exhaustive):
- Backend: auth, authorization, Project isolation, validation, core business logic.
- AI: grounded responses, unsupported-question handling, structured outputs, Tutor behavior, assessment evaluation.
- Learning: mastery updates, adaptive question selection, recommendations.
- Background processing: successful jobs, retries, failure handling.

**Deployment:**
- Must be deployed to a **publicly accessible URL**.
- Must demonstrate working frontend, backend, DB, auth, AI functionality, document processing, background processing.
- Secrets/config separated from source; **no secrets committed**.

### MoSCoW

**Must Have**
Auth · Spaces & Projects · PDF materials · background document processing · AI Tutor · grounded answers with citations · unsupported-question handling · adaptive quiz · open-ended assessment · concept mastery · growth analysis · recommendations · project & global analytics · activity tracking · admin dashboard · persistent relevant learning context · project-level data isolation · structured AI interaction · basic AI observability & evaluation · error handling · testing · deployment · public repo · architecture documentation.

**Should Have** (if time permits)
Streaming Tutor · richer document understanding · improved analytics · persistent Tutor continuity · background learning insights · caching · AI tracing · provider abstraction · automated regression evaluation · improved workflow retry handling.

**Nice to Have** (creative additions — must not compromise the core loop)
Voice learning · flashcards · spaced repetition · learning plans · concept maps · simulations · personalized schedules · multi-modal learning · notifications · collaboration · advanced analytics.

---

## 17. Success Criteria

Primary success criterion — a user can complete the full loop **without losing context**:
```
Space → Project → Material → Knowledge → Tutor → Grounded Answer + Citation
→ Unsupported Question Handling → Adaptive Quiz → Assessment → Mastery → Growth
→ Analytics → Recommendation → Continue Learning
```
Simultaneously, an admin can inspect users, Projects, activity, analytics, AI usage, AI evaluation, and system health.

Demonstrated understanding expected across: full-stack architecture, AI/LLM integration, retrieval, persistent context, structured AI outputs, AI/application interaction, background processing, event-driven workflows, security, data isolation, observability, AI evaluation, testing, performance, deployment.

Candidates should document: what was selected & why, what was simplified, what would be improved with more time.

**Evaluation weighs engineering reasoning and implementation quality — not technology popularity or feature count.**

---

## 18. Final Submission Requirements

1. **Working application** deployed at a public URL demonstrating the core learning loop.
2. **Demo video** walking the full loop: Create Space → Create Project → Upload Material → Process Material → Ask Tutor → Grounded Answer + Citation → Unsupported Question → Adaptive Quiz → Open-Ended Assessment → Mastery/Growth → Analytics → Recommendation → Admin Dashboard.
3. **Public GitHub repository**: source, README, setup instructions, config examples, architecture docs, testing instructions, deployment info.
4. **Architecture documentation**: diagram + explanation of major decisions.
5. **AI usage documentation**, clearly distinguishing:
   - AI used *to build* the product (coding assistants, debugging/design tools, dev agents)
   - AI used *by* the product itself (Tutor, quiz gen, assessment, recommendations, doc understanding, eval models)
6. **Development prompts**: actual prompts used with AI dev tools, organized by area (architecture, frontend, backend, DB, AI, debugging, testing, docs).
7. **Evaluation approach** write-up: how Tutor/retrieval/assessment/recommendation quality was evaluated.
8. **Known limitations**: AI, retrieval, documents, scaling, security, cost, UI, background processing.
9. **Future improvements** (optional): what you'd build next.

---

## 19. Creativity & Differentiation

- Requirements define the **baseline**, not the ceiling.
- Reward comes from good product decisions, thoughtful AI usage, strong learning experiences — **not feature count**.
- Differentiation axes: intelligent automation, engineering quality, creativity, reliability, user usefulness.
- Solving an important unstated problem thoughtfully is viewed positively.

---

## 20. Final Challenge Framing

> Build an AI Study Companion that feels less like a chatbot and more like a real learning partner — one that understands what the user is learning, uses their materials as evidence, remembers relevant context, explains concepts, evaluates understanding, identifies weaknesses, tracks mastery, recommends what to do next, and continuously adapts. At the same time, demonstrate a modern full-stack AI system: appropriate architecture, async processing, reliable AI interactions, controlled application capabilities, data isolation, security, observability, evaluation, testing, and deployment.
>
> **"Don't just build what is written. Build what you believe the product should become."**

---

## 21. Requirement → Data Entity Cross-Reference (derived, not explicit in PRD)

To ground the architecture, the following entities are implied by the requirements above:

| Entity | Key attributes (implied) | Owned by |
|---|---|---|
| `User` | id, email, auth identity, role (user/admin) | — |
| `Space` | id, user_id, name, description, visual theme | User |
| `Project` | id, space_id, name, description, learning_goal, status | Space |
| `Material` | id, project_id, file, type, status (queued/processing/ready/failed), page_count | Project |
| `MaterialChunk` / `Knowledge` | id, material_id, content, page_ref, embedding, metadata | Material |
| `Concept` | id, project_id, name, description, source refs | Project |
| `Conversation` | id, project_id, user_id, title, created_at | Project |
| `Message` | id, conversation_id, role, content, citations[], tokens, model, latency, cost | Conversation |
| `Quiz` / `QuizAttempt` | id, project_id, concept mix, status | Project |
| `Question` | id, quiz_id, type (mcq/open), concept_id, difficulty, prompt, answer_key | Quiz |
| `Response` | id, question_id, user_answer, evaluation, score, feedback | Question |
| `Mastery` | id, project_id, concept_id, level (0-100), last_updated, evidence_refs | Project+Concept |
| `GrowthSnapshot` | id, project_id, concept_id, timestamp, mastery_value, trend | Project+Concept |
| `Recommendation` | id, project_id, text, rationale, status (active/dismissed/completed), created_at | Project |
| `LearningContext` | id, project_id, type (goal/strength/weakness/mistake/preference), content, relevance_score | Project |
| `Event` / `ActivityLog` | id, user_id, project_id, type, payload, created_at | User/Project |
| `BackgroundJob` | id, type, status, payload, retry_count, error, related_entity | — |
| `AIUsageLog` | id, feature, model, tokens_in/out, latency_ms, cost_estimate, success | — |
| `EvalResult` | id, feature, test_case_id, score, verdict, notes | — |

This table is a first pass and will be refined in the data-model section of the implementation plan.

---

## 22. Ambiguities / Decisions the PRD Deliberately Leaves Open

The PRD repeatedly states "left to the candidate" / "intentionally open" for:
1. Tech stack (frontend, backend, DB, auth, hosting)
2. Document processing / OCR technology
3. Retrieval & knowledge representation technique (chunking, embeddings, graph, hybrid)
4. LLM provider(s) and model(s)
5. Background job / queue technology
6. Mastery estimation algorithm
7. Adaptive question-selection algorithm
8. Observability & evaluation tooling
9. How much of "Should Have" / "Nice to Have" to attempt given the 3–4 day timebox
10. Additional creative differentiation features

These are addressed as explicit decision points in the Implementation Plan (`02-ARCHITECTURE-DECISIONS.md`) rather than assumed.
