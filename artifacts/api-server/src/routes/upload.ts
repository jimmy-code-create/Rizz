import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";

const router = Router();
const UPLOADS_DIR = path.resolve("./uploads");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
    if (req.file) {
      const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "bin";
      const name = `${randomUUID()}.${ext}`;
      await writeFile(path.join(UPLOADS_DIR, name), req.file.buffer);
      res.json({ url: `/api/uploads/${name}` });
      return;
    }
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl) { res.status(400).json({ error: "No file or dataUrl provided" }); return; }
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) { res.json({ url: dataUrl }); return; }
    const mimeType = match[1]!;
    const base64Data = match[2]!;
    const ext = mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(UPLOADS_DIR, name), Buffer.from(base64Data, "base64"));
    res.json({ url: `/api/uploads/${name}` });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
