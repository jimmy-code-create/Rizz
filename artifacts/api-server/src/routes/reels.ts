import { Router } from "express";
import { db } from "../lib/db.js";
import { reelsTable, reelLikesTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

async function enrichReel(r: typeof reelsTable.$inferSelect, viewerId: string) {
  const [author, likedRow] = await Promise.all([
    db.query.usersTable.findFirst({ where: eq(usersTable.id, r.authorId) }),
    db.query.reelLikesTable.findFirst({ where: and(eq(reelLikesTable.reelId, r.id), eq(reelLikesTable.userId, viewerId)) }),
  ]);
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    isLiked: !!likedRow,
    author: author ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, isVerified: author.isVerified } : null,
  };
}

// GET /api/reels
router.get("/", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const reels = await db.query.reelsTable.findMany({ orderBy: [desc(reelsTable.createdAt)], limit: 50 });
  const enriched = await Promise.all(reels.map((r) => enrichReel(r, userId)));
  res.json({ reels: enriched });
});

// GET /api/reels/trending
router.get("/trending", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const { sql, desc: d } = await import("drizzle-orm");
  const reels = await db.query.reelsTable.findMany({ orderBy: [desc(reelsTable.viewCount)], limit: 20 });
  const enriched = await Promise.all(reels.map((r) => enrichReel(r, userId)));
  res.json({ reels: enriched });
});

// POST /api/reels
router.post("/", requireAuth, async (req, res) => {
  const { videoUrl, caption } = req.body as { videoUrl: string; caption?: string };
  if (!videoUrl) { res.status(400).json({ error: "videoUrl required" }); return; }
  const [reel] = await db.insert(reelsTable).values({
    authorId: req.session!.userId!, videoUrl, caption: caption ?? null,
  }).returning();
  const enriched = await enrichReel(reel!, req.session!.userId!);
  res.status(201).json(enriched);
});

// POST /api/reels/:reelId/view
router.post("/:reelId/view", requireAuth, async (req, res) => {
  const reelId = Number(req.params["reelId"]);
  const reel = await db.query.reelsTable.findFirst({ where: eq(reelsTable.id, reelId) });
  if (reel) await db.update(reelsTable).set({ viewCount: reel.viewCount + 1 }).where(eq(reelsTable.id, reelId));
  res.json({ ok: true });
});

// POST /api/reels/:reelId/like
router.post("/:reelId/like", requireAuth, async (req, res) => {
  const reelId = Number(req.params["reelId"]);
  const userId = req.session!.userId!;
  const existing = await db.query.reelLikesTable.findFirst({ where: and(eq(reelLikesTable.reelId, reelId), eq(reelLikesTable.userId, userId)) });
  if (!existing) {
    await db.insert(reelLikesTable).values({ reelId, userId });
    const reel = await db.query.reelsTable.findFirst({ where: eq(reelsTable.id, reelId) });
    if (reel) await db.update(reelsTable).set({ likeCount: reel.likeCount + 1 }).where(eq(reelsTable.id, reelId));
  }
  res.json({ ok: true });
});

// POST /api/reels/:reelId/unlike
router.post("/:reelId/unlike", requireAuth, async (req, res) => {
  const reelId = Number(req.params["reelId"]);
  const userId = req.session!.userId!;
  await db.delete(reelLikesTable).where(and(eq(reelLikesTable.reelId, reelId), eq(reelLikesTable.userId, userId)));
  const reel = await db.query.reelsTable.findFirst({ where: eq(reelsTable.id, reelId) });
  if (reel && reel.likeCount > 0) await db.update(reelsTable).set({ likeCount: reel.likeCount - 1 }).where(eq(reelsTable.id, reelId));
  res.json({ ok: true });
});

export default router;
