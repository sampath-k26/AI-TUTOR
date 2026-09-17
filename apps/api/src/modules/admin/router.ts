import { Router } from "express";
import { requireAdmin, requireAuth } from "../../core/auth";
import * as service from "./service";
import { activityQuerySchema, paginationQuerySchema } from "./schemas";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/admin/users", async (req, res) => {
  const query = paginationQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }
  const result = await service.getUsers(query.data.limit, query.data.offset);
  res.json(result);
});

adminRouter.get("/admin/spaces", async (req, res) => {
  const query = paginationQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }
  const spaces = await service.getSpaces(query.data.limit, query.data.offset);
  res.json({ spaces });
});

adminRouter.get("/admin/projects", async (req, res) => {
  const query = paginationQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }
  const projects = await service.getProjects(query.data.limit, query.data.offset);
  res.json({ projects });
});

adminRouter.get("/admin/activity", async (req, res) => {
  const query = activityQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }
  const { limit, offset, type, userId, from, to } = query.data;
  const activity = await service.getActivity(
    { type, userId, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
    limit,
    offset,
  );
  res.json({ activity });
});

adminRouter.get("/admin/engagement", async (_req, res) => {
  const engagement = await service.getEngagement();
  res.json({ engagement });
});

adminRouter.get("/admin/engagement-history", async (_req, res) => {
  const history = await service.getEngagementHistory();
  res.json({ history });
});

adminRouter.get("/admin/ai-usage-history", async (_req, res) => {
  const history = await service.getPlatformAiUsageHistory();
  res.json({ history });
});

adminRouter.get("/admin/learning-analytics", async (_req, res) => {
  const learningAnalytics = await service.getLearningAnalytics();
  res.json({ learningAnalytics });
});

adminRouter.get("/admin/ai-usage", async (_req, res) => {
  const aiUsage = await service.getAiUsage();
  res.json({ aiUsage });
});

adminRouter.get("/admin/ai-evaluation", async (_req, res) => {
  const aiEvaluation = await service.getAiEvaluation();
  res.json({ aiEvaluation });
});

adminRouter.get("/admin/background-jobs", async (_req, res) => {
  const backgroundJobs = await service.getBackgroundJobs();
  res.json({ backgroundJobs });
});

adminRouter.get("/admin/system-health", async (_req, res) => {
  const systemHealth = await service.getSystemHealth();
  res.json({ systemHealth });
});
