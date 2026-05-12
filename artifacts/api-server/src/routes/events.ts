import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { addSseClient, removeSseClient } from "../lib/sse.js";

const router = Router();

router.get("/events", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`: connected\n\n`);
  const userId = req.session!.userId!;
  addSseClient(userId, res);
  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch { clearInterval(heartbeat); }
  }, 20000);
  req.on("close", () => { clearInterval(heartbeat); removeSseClient(userId, res); });
});

export default router;
