import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/vapid-key", (_req, res) => {
  const key = process.env["VAPID_PUBLIC_KEY"];
  if (!key) { res.status(503).json({ error: "Push not configured" }); return; }
  res.json({ publicKey: key });
});

router.post("/subscribe", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const { endpoint, p256dh, auth } = req.body as { endpoint: string; p256dh: string; auth: string };
  if (!endpoint || !p256dh || !auth) { res.status(400).json({ error: "Missing subscription fields" }); return; }
  await db.update(usersTable)
    .set({ pushSubscription: { endpoint, keys: { p256dh, auth } } })
    .where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

router.delete("/subscribe", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  await db.update(usersTable).set({ pushSubscription: null }).where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

export default router;
