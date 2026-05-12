import { Router } from "express";
import { db } from "../lib/db.js";
import { storiesTable, storyViewsTable, usersTable } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const now = new Date();
  const stories = await db.query.storiesTable.findMany({ where: gt(storiesTable.expiresAt, now), orderBy: [desc(storiesTable.createdAt)], limit: 200 });
  const views = await db.query.storyViewsTable.findMany({ where: eq(storyViewsTable.viewerId, userId) });
  const viewedIds = new Set(views.map((v) => v.storyId));
  const grouped = new Map<string, typeof stories>();
  for (const s of stories) {
    if (!grouped.has(s.authorId)) grouped.set(s.authorId, []);
    grouped.get(s.authorId)!.push(s);
  }
  const groups = await Promise.all(
    Array.from(grouped.entries()).map(async ([authorId, ss]) => {
      const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, authorId) });
      const storiesWithMeta = ss.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        textOverlay: s.textOverlay,
        viewed: viewedIds.has(s.id),
        author: author ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl } : null,
      }));
      return {
        user: author ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl } : { id: authorId },
        stories: storiesWithMeta,
        hasUnviewed: storiesWithMeta.some((s) => !s.viewed),
      };
    })
  );
  res.json({ groups });
});

router.post("/", requireAuth, async (req, res) => {
  const { mediaUrl, type, caption, textOverlay } = req.body as { mediaUrl: string; type: string; caption?: string; textOverlay?: unknown };
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const [story] = await db.insert(storiesTable).values({
    authorId: req.session!.userId!, mediaUrl, type: type ?? "image", caption: caption ?? null, textOverlay: textOverlay ?? null, expiresAt,
  }).returning();
  const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  res.status(201).json({
    ...story,
    createdAt: story!.createdAt.toISOString(),
    expiresAt: story!.expiresAt.toISOString(),
    viewed: false,
    author: author ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl } : null,
  });
});

router.post("/:storyId/view", requireAuth, async (req, res) => {
  const storyId = Number(req.params["storyId"]);
  const viewerId = req.session!.userId!;
  const existing = await db.query.storyViewsTable.findFirst({ where: and(eq(storyViewsTable.storyId, storyId), eq(storyViewsTable.viewerId, viewerId)) });
  if (!existing) {
    await db.insert(storyViewsTable).values({ storyId, viewerId });
    const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
    if (story) await db.update(storiesTable).set({ viewCount: story.viewCount + 1 }).where(eq(storiesTable.id, storyId));
  }
  res.json({ ok: true });
});

router.get("/:storyId/viewers", requireAuth, async (req, res) => {
  const storyId = Number(req.params["storyId"]);
  const views = await db.query.storyViewsTable.findMany({ where: eq(storyViewsTable.storyId, storyId), orderBy: [desc(storyViewsTable.viewedAt)], limit: 200 });
  const viewers = await Promise.all(views.map(async (v) => {
    const viewer = await db.query.usersTable.findFirst({ where: eq(usersTable.id, v.viewerId) });
    return { id: v.viewerId, username: viewer?.username ?? null, displayName: viewer?.displayName ?? null, avatarUrl: viewer?.avatarUrl ?? null, viewedAt: v.viewedAt.toISOString() };
  }));
  res.json({ viewers });
});

router.delete("/:storyId", requireAuth, async (req, res) => {
  const storyId = Number(req.params["storyId"]);
  const userId = req.session!.userId!;
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
  if (!story) { res.status(404).json({ error: "Story not found" }); return; }
  if (story.authorId !== userId) { res.status(403).json({ error: "Not your story" }); return; }
  await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
  res.json({ ok: true });
});

export default router;
