import { Router } from "express";
import { requireAuth } from "../../core/auth";
import * as service from "./service";
import { activityQuerySchema, projectIdParamSchema } from "./schemas";

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

analyticsRouter.get("/home", async (req, res) => {
  const home = await service.getHomeOverview(req.user!.id);
  res.json({ home });
});

/** Sidebar's Activity log — the current user's own events only (not admin's platform-wide view). */
analyticsRouter.get("/activity", async (req, res) => {
  const query = activityQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const result = await service.getUserActivity(req.user!.id, query.data.category, query.data.limit, query.data.offset);
  res.json(result);
});
