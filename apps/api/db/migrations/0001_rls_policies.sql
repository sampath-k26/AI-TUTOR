-- Row-Level Security policies (decision D16, defense layer 2).
-- Our Express backend connects via the `postgres` role (BYPASSRLS) and enforces
-- ownership explicitly in every repository query (defense layer 1) — these
-- policies protect any other access path (e.g. Supabase's PostgREST API with a
-- user JWT) from ever seeing another user's data, even if the app-layer check
-- were ever bypassed or a bug slipped through.

-- profiles: a user can see/update only their own row.
CREATE POLICY "profiles_select_own" ON "profiles" FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON "profiles" FOR UPDATE USING (id = auth.uid());

-- spaces: directly owned.
CREATE POLICY "spaces_all_own" ON "spaces" FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- projects: directly owned.
CREATE POLICY "projects_all_own" ON "projects" FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Everything below is scoped via project_id -> projects.owner_id.
CREATE POLICY "materials_all_own" ON "materials" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "material_chunks_all_own" ON "material_chunks" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "concepts_all_own" ON "concepts" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "mastery_all_own" ON "mastery" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "growth_snapshots_all_own" ON "growth_snapshots" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "conversations_all_own" ON "conversations" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "quizzes_all_own" ON "quizzes" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "recommendations_all_own" ON "recommendations" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "learning_context_all_own" ON "learning_context" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- messages: scoped two levels up, via conversations.project_id.
CREATE POLICY "messages_all_own" ON "messages" FOR ALL
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  ))
  WITH CHECK (conversation_id IN (
    SELECT id FROM conversations WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  ));

-- questions: scoped two levels up, via quizzes.project_id.
CREATE POLICY "questions_all_own" ON "questions" FOR ALL
  USING (quiz_id IN (
    SELECT id FROM quizzes WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  ))
  WITH CHECK (quiz_id IN (
    SELECT id FROM quizzes WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  ));

-- responses: scoped three levels up, via questions.quiz_id -> quizzes.project_id.
CREATE POLICY "responses_all_own" ON "responses" FOR ALL
  USING (question_id IN (
    SELECT id FROM questions WHERE quiz_id IN (
      SELECT id FROM quizzes WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    )
  ))
  WITH CHECK (question_id IN (
    SELECT id FROM questions WHERE quiz_id IN (
      SELECT id FROM quizzes WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    )
  ));

-- events: a user's own activity (project_id may be null for account-level events).
CREATE POLICY "events_all_own" ON "events" FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ai_usage_log and eval_result intentionally get RLS enabled with NO policies:
-- they are platform-internal observability data (feeds the Admin Dashboard only),
-- not user-owned data. Only the backend's direct `postgres` connection (which
-- bypasses RLS) and, through it, an authenticated admin via the API should ever
-- read them — no end-user role should see these rows directly.
