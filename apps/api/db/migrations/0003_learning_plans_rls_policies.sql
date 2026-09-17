-- Row-Level Security policies for learning_plans/learning_plan_steps (M13),
-- following 0001_rls_policies.sql's exact pattern (decision D16, defense layer 2).

CREATE POLICY "learning_plans_all_own" ON "learning_plans" FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- learning_plan_steps: scoped two levels up, via learning_plans.project_id.
CREATE POLICY "learning_plan_steps_all_own" ON "learning_plan_steps" FOR ALL
  USING (plan_id IN (
    SELECT id FROM learning_plans WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  ))
  WITH CHECK (plan_id IN (
    SELECT id FROM learning_plans WHERE project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  ));
