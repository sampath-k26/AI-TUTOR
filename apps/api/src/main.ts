import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { config } from "./core/config";
import { learningRouter } from "./modules/learning/router";
import { materialsRouter } from "./modules/materials/router";
import { aiRouter } from "./modules/ai/router";
import { assessmentRouter } from "./modules/assessment/router";
import { analyticsRouter } from "./modules/analytics/router";
import { adminRouter } from "./modules/admin/router";
import { learningPlansRouter } from "./modules/learningPlans/router";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", learningRouter);
app.use("/api", materialsRouter);
app.use("/api", aiRouter);
app.use("/api", assessmentRouter);
app.use("/api", analyticsRouter);
app.use("/api", learningPlansRouter);
// adminRouter must be mounted last: its own requireAdmin middleware runs (and can
// 403-terminate the request) for every /api/* path that reaches it, not just its
// own routes — a router mounted after it would never be reached for a non-admin caller.
app.use("/api", adminRouter);

// Central error handler — catches everything forwarded via next(err), including
// rejected promises from async route handlers (Express 5 does this automatically).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  // A streaming route (M9) may already have written and flushed response headers
  // before failing — calling res.status()/json() at that point throws
  // ERR_HTTP_HEADERS_SENT. Just end the response; the client already got a
  // stream-level error event.
  if (res.headersSent) {
    res.end();
    return;
  }

  // Found live during a security pass: an oversized JSON body, malformed JSON, and
  // an oversized file upload all reached here and were reported as a 500, even
  // though body-parser/multer already know these are client mistakes. body-parser
  // attaches the correct HTTP status to its own errors (413 too-large, 400 parse
  // failure) — surface that instead of collapsing every non-4xx-handled error to 500.
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status ?? (err as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: err instanceof Error ? err.message : "Bad request" });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(413).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`AI-TUTOR API listening on port ${config.PORT}`);
});
