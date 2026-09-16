import { Router } from "express";
import { requireAuth } from "../../core/auth";
import * as service from "./service";
import { projectIdParamSchema } from "./schemas";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get("/projects/:projectId/analytics", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const analytics = await service.getProjectAnalytics(params.data.projectId, req.user!.id);
  if (!analytics) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ analytics });
});

analyticsRouter.get("/analytics", async (req, res) => {
  const analytics = await service.getGlobalAnalytics(req.user!.id);
  res.json({ analytics });
});
