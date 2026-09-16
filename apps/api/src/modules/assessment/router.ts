import { Router } from "express";
import { requireAuth } from "../../core/auth";
import * as service from "./service";
import { projectIdParamSchema, questionIdParamSchema, quizIdParamSchema, recommendationIdParamSchema, submitAnswerBodySchema } from "./schemas";

export const assessmentRouter = Router();

assessmentRouter.use(requireAuth);

assessmentRouter.post("/projects/:projectId/quizzes", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const quiz = await service.startQuiz(params.data.projectId, req.user!.id);
  if (!quiz) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(201).json({ quiz });
});

assessmentRouter.post("/projects/:projectId/quizzes/:quizId/next-question", async (req, res) => {
  const params = projectIdParamSchema.merge(quizIdParamSchema).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const result = await service.generateNextQuestion(params.data.quizId, params.data.projectId, req.user!.id);
  if (!result) {
    res.status(404).json({ error: "Project or quiz not found" });
    return;
  }
  if ("noConceptsAvailable" in result) {
    res.status(409).json({ error: "No concepts available yet — upload and process material first" });
    return;
  }

  res.status(201).json(result);
});

assessmentRouter.post("/projects/:projectId/questions/:questionId/answer", async (req, res) => {
  const params = projectIdParamSchema.merge(questionIdParamSchema).safeParse(req.params);
  const body = submitAnswerBodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: { params: params.error?.flatten(), body: body.error?.flatten() } });
    return;
  }

  const result = await service.submitAnswer(params.data.questionId, params.data.projectId, req.user!.id, body.data.answer);
  if (!result) {
    res.status(404).json({ error: "Project or question not found" });
    return;
  }

  res.json(result);
});

assessmentRouter.post("/projects/:projectId/quizzes/:quizId/finish", async (req, res) => {
  const params = projectIdParamSchema.merge(quizIdParamSchema).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const result = await service.finishQuiz(params.data.quizId, params.data.projectId, req.user!.id);
  if (!result) {
    res.status(404).json({ error: "Project or quiz not found" });
    return;
  }

  res.json(result);
});

assessmentRouter.get("/projects/:projectId/growth", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const growth = await service.getGrowthOverview(params.data.projectId, req.user!.id);
  if (!growth) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ growth });
});

assessmentRouter.get("/projects/:projectId/recommendations", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const recommendations = await service.getRecommendations(params.data.projectId, req.user!.id);
  if (!recommendations) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ recommendations });
});

assessmentRouter.post("/projects/:projectId/recommendations/:recommendationId/dismiss", async (req, res) => {
  const params = projectIdParamSchema.merge(recommendationIdParamSchema).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const result = await service.dismissRecommendation(params.data.recommendationId, params.data.projectId, req.user!.id);
  if (!result) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(result);
});
