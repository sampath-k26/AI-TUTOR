import { Router } from "express";
import { requireAuth } from "../../core/auth";
import * as service from "./service";
import { projectIdParamSchema, setStepCompletedBodySchema, stepIdParamSchema } from "./schemas";

export const learningPlansRouter = Router();

learningPlansRouter.use(requireAuth);

learningPlansRouter.get("/projects/:projectId/learning-plan", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const result = await service.getPlan(params.data.projectId, req.user!.id);
  if (!result) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(result);
});

learningPlansRouter.post("/projects/:projectId/learning-plan/generate", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const result = await service.generatePlan(params.data.projectId, req.user!.id);
  if (!result) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(201).json(result);
});

learningPlansRouter.post("/projects/:projectId/learning-plan/steps/:stepId", async (req, res) => {
  const params = projectIdParamSchema.merge(stepIdParamSchema).safeParse(req.params);
  const body = setStepCompletedBodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: { params: params.error?.flatten(), body: body.error?.flatten() } });
    return;
  }

  const step = await service.setStepCompleted(params.data.stepId, params.data.projectId, req.user!.id, body.data.completed);
  if (!step) {
    res.status(404).json({ error: "Project or step not found" });
    return;
  }

  res.json({ step });
});
