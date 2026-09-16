import { Router } from "express";
import { requireAuth } from "../../core/auth";
import * as service from "./service";
import { projectIdParamSchema, sendMessageSchema } from "./schemas";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post("/projects/:projectId/tutor/messages", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  const body = sendMessageSchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: { params: params.error?.flatten(), body: body.error?.flatten() } });
    return;
  }

  const reply = await service.handleTutorMessage(params.data.projectId, req.user!.id, body.data.content, body.data.conversationId);
  if (!reply) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(201).json(reply);
});
