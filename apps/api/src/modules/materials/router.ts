import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../core/auth";
import * as service from "./service";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, materialIdParamSchema, projectIdParamSchema } from "./schemas";

export const materialsRouter = Router();

materialsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(new Error("Only PDF files are supported"));
      return;
    }
    cb(null, true);
  },
});

materialsRouter.get("/projects/:projectId/materials", async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const materials = await service.listMaterials(params.data.projectId, req.user!.id);
  if (!materials) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ materials });
});

materialsRouter.post("/projects/:projectId/materials", upload.single("file"), async (req, res) => {
  const params = projectIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "A PDF file is required (field name: file)" });
    return;
  }

  const material = await service.uploadMaterial(params.data.projectId, req.user!.id, req.file);
  if (!material) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(201).json({ material });
});

materialsRouter.get("/materials/:materialId", async (req, res) => {
  const params = materialIdParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.flatten() });
    return;
  }

  const material = await service.getMaterial(params.data.materialId, req.user!.id);
  if (!material) {
    res.status(404).json({ error: "Material not found" });
    return;
  }

  res.json({ material });
});
