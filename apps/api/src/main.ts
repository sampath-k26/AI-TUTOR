import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./core/config";
import { learningRouter } from "./modules/learning/router";
import { materialsRouter } from "./modules/materials/router";
import { aiRouter } from "./modules/ai/router";
import { assessmentRouter } from "./modules/assessment/router";
import { analyticsRouter } from "./modules/analytics/router";

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

// Central error handler — catches everything forwarded via next(err), including
// rejected promises from async route handlers (Express 5 does this automatically).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`AI-TUTOR API listening on port ${config.PORT}`);
});
