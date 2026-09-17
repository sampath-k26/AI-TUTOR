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

/**
 * Streaming sibling of the endpoint above (M9) — that one is left completely
 * untouched. Newline-delimited JSON over a normal authenticated POST, not native
 * EventSource (which can't carry this app's Bearer auth header or send a body).
 */
aiRouter.post("/projects/:projectId/tutor/messages/stream", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  const body = sendMessageSchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: { params: params.error?.flatten(), body: body.error?.flatten() } });
    return;
  }

  const stream = await service.handleTutorMessageStream(params.data.projectId, req.user!.id, body.data.content, body.data.conversationId);
  if (!stream) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson");
  res.flushHeaders();
  try {
    for await (const event of stream) {
      res.write(JSON.stringify(event) + "\n");
    }
  } catch {
    res.write(JSON.stringify({ type: "error", message: "The Tutor's response was interrupted." }) + "\n");
  } finally {
    res.end();
  }
});
