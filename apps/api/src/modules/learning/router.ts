import { Router } from "express";
import { requireAuth } from "../../core/auth";
import * as service from "./service";
import { createProjectSchema, createSpaceSchema, projectIdParamSchema, spaceIdParamSchema } from "./schemas";

export const learningRouter = Router();

learningRouter.use(requireAuth);

// Note: Express 5 forwards a rejected promise from an async handler to the error
// middleware automatically — no manual try/catch-and-next wrapper needed here.

learningRouter.get("/me", async (req, res) => {
  const profile = await service.ensureProfile(req.user!.id, req.user!.email);
  res.json({ profile });
});

learningRouter.get("/spaces", async (req, res) => {
  const spaces = await service.listSpaces(req.user!.id);
  res.json({ spaces });
});

learningRouter.post("/spaces", async (req, res) => {
  const parsed = createSpaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const space = await service.createSpace(req.user!.id, parsed.data);
  res.status(201).json({ space });
});

learningRouter.get("/spaces/:spaceId", async (req, res) => {
  const params = spaceIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const dashboard = await service.getSpaceDashboard(params.data.spaceId, req.user!.id);
  if (!dashboard) {
    res.status(404).json({ error: "Space not found" });
    return;
  }

  res.json(dashboard);
});

learningRouter.post("/spaces/:spaceId/projects", async (req, res) => {
  const params = spaceIdParamSchema.safeParse(req.params);
  const body = createProjectSchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: { params: params.error?.flatten(), body: body.error?.flatten() } });
    return;
  }

  const project = await service.createProject(params.data.spaceId, req.user!.id, body.data);
  if (!project) {
    res.status(404).json({ error: "Space not found" });
    return;
  }

  res.status(201).json({ project });
});

learningRouter.get("/projects", async (req, res) => {
  const projects = await service.listAllProjects(req.user!.id);
  res.json({ projects });
});

learningRouter.get("/projects/:projectId", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const project = await service.getProjectDashboard(params.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ project });
});
