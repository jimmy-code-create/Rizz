import { Router } from "express";
import { db } from "../lib/db.js";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const notifs = await db.query.notificationsTable.findMany({ where: eq(notificationsTable.userId, userId), orderBy: [desc(notificationsTable.createdAt)], limit: 50 });
  const enriched = await Promise.all(notifs.map(async (n) => {
    const actor = n.actorId ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, n.actorId) }) : null;
    return { ...n, createdAt: n.createdAt.toISOString(), actor: actor ? { id: actor.id, username: actor.username, displayName: actor.displayName, avatarUrl: actor.avatarUrl } : null };
  }));
  res.json({ notifications: enriched });
});

router.post("/read-all", requireAuth, async (req, res) => {
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, req.session!.userId!));
  res.json({ ok: true });
});

export default router;
