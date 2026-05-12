import { Router } from "express";
import { db } from "../lib/db.js";
import { badgesTable, userBadgesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const all = await db.query.badgesTable.findMany();
  const owned = await db.query.userBadgesTable.findMany({ where: eq(userBadgesTable.userId, userId) });
  const ownedIds = new Set(owned.map((o) => o.badgeId));
  const ownedMap = new Map(owned.map((o) => [o.badgeId, o]));
  res.json({ badges: all.map((b) => ({ ...b, owned: ownedIds.has(b.id), earnedAt: ownedMap.get(b.id)?.earnedAt?.toISOString() ?? null })) });
});

export default router;
