import { Router } from "express";
import { db } from "../lib/db.js";
import { postsTable, likesTable, savesTable, commentsTable, usersTable, notificationsTable, userBadgesTable, badgesTable } from "@workspace/db";
import { eq, and, desc, or, ilike } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendSseEvent } from "../lib/sse.js";
import { sendPushToUser } from "../lib/push.js";

const router = Router();

async function getTopBadge(userId: string) {
  const row = await db.select({ badge: badgesTable }).from(userBadgesTable).innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id)).where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.isTop, true))).limit(1);
  return row[0]?.badge ?? null;
}

async function enrichPost(p: typeof postsTable.$inferSelect, viewerId: string) {
  const [liked, saved, author] = await Promise.all([
    db.query.likesTable.findFirst({ where: and(eq(likesTable.userId, viewerId), eq(likesTable.postId, p.id)) }),
    db.query.savesTable.findFirst({ where: and(eq(savesTable.userId, viewerId), eq(savesTable.postId, p.id)) }),
    db.query.usersTable.findFirst({ where: eq(usersTable.id, p.authorId) }),
  ]);
  const topBadge = author ? await getTopBadge(author.id) : null;
  return {
    ...p, tags: (p.tags as string[]) ?? [], isLiked: !!liked, isSaved: !!saved,
    createdAt: p.createdAt.toISOString(),
    author: author ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, isVerified: author.isVerified, topBadge } : null,
  };
}

router.get(["/", "/feed"], requireAuth, async (req, res) => {
  const posts = await db.query.postsTable.findMany({ orderBy: [desc(postsTable.createdAt)], limit: 50 });
  const enriched = await Promise.all(posts.map((p) => enrichPost(p, req.session!.userId!)));
  res.json({ posts: enriched });
});

router.get("/saved", requireAuth, async (req, res) => {
  const saved = await db.select({ post: postsTable }).from(savesTable).innerJoin(postsTable, eq(savesTable.postId, postsTable.id)).where(eq(savesTable.userId, req.session!.userId!)).orderBy(desc(savesTable.createdAt));
  const enriched = await Promise.all(saved.map((r) => enrichPost(r.post, req.session!.userId!)));
  res.json({ posts: enriched });
});

router.get("/search", requireAuth, async (req, res) => {
  const q = (req.query["q"] as string) ?? "";
  if (!q) { res.json({ posts: [] }); return; }
  const posts = await db.query.postsTable.findMany({ where: ilike(postsTable.content, `%${q}%`), orderBy: [desc(postsTable.createdAt)], limit: 30 });
  const enriched = await Promise.all(posts.map((p) => enrichPost(p, req.session!.userId!)));
  res.json({ posts: enriched });
});

router.post("/", requireAuth, async (req, res) => {
  const { content, imageUrl, mediaUrl: rawMediaUrl, tags } = req.body as { content: string; imageUrl?: string; mediaUrl?: string; tags?: string[] };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
  const resolvedMediaUrl = rawMediaUrl ?? imageUrl ?? null;
  const [post] = await db.insert(postsTable).values({ authorId: req.session!.userId!, content, mediaUrl: resolvedMediaUrl, tags: tags ?? [] }).returning();
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  if (user) await db.update(usersTable).set({ postCount: user.postCount + 1 }).where(eq(usersTable.id, req.session!.userId!));
  const enriched = await enrichPost(post!, req.session!.userId!);
  res.status(201).json(enriched);
});

router.get("/:postId", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichPost(post, req.session!.userId!));
});

router.delete("/:postId", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  if (post.authorId !== req.session!.userId!) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  if (user && user.postCount > 0) await db.update(usersTable).set({ postCount: user.postCount - 1 }).where(eq(usersTable.id, req.session!.userId!));
  res.json({ ok: true });
});

router.post("/:postId/like", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  const userId = req.session!.userId!;
  const existing = await db.query.likesTable.findFirst({ where: and(eq(likesTable.userId, userId), eq(likesTable.postId, postId)) });
  if (!existing) {
    await db.insert(likesTable).values({ userId, postId });
    const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
    if (post) {
      await db.update(postsTable).set({ likeCount: post.likeCount + 1 }).where(eq(postsTable.id, postId));
      if (post.authorId !== userId) {
        const actor = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
        const actorName = actor?.displayName ?? actor?.username ?? "Someone";
        await db.insert(notificationsTable).values({ userId: post.authorId, actorId: userId, type: "like", entityId: String(postId), message: `${actorName} liked your post` });
        sendSseEvent(post.authorId, "new_like", { postId, actorName });
        sendSseEvent(post.authorId, "new_notification", { notifType: "like", message: `${actorName} liked your post`, actorName });
        sendPushToUser(post.authorId, { title: "New like", body: `${actorName} liked your post`, tag: `like-${postId}`, data: { url: "/" } });
      }
    }
  }
  res.json({ ok: true });
});

router.post("/:postId/unlike", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  await db.delete(likesTable).where(and(eq(likesTable.userId, req.session!.userId!), eq(likesTable.postId, postId)));
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (post && post.likeCount > 0) await db.update(postsTable).set({ likeCount: post.likeCount - 1 }).where(eq(postsTable.id, postId));
  res.json({ ok: true });
});

router.post("/:postId/save", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  const existing = await db.query.savesTable.findFirst({ where: and(eq(savesTable.userId, req.session!.userId!), eq(savesTable.postId, postId)) });
  if (!existing) await db.insert(savesTable).values({ userId: req.session!.userId!, postId });
  res.json({ ok: true });
});

router.post("/:postId/unsave", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  await db.delete(savesTable).where(and(eq(savesTable.userId, req.session!.userId!), eq(savesTable.postId, postId)));
  res.json({ ok: true });
});

router.get("/:postId/comments", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  const comments = await db.query.commentsTable.findMany({ where: eq(commentsTable.postId, postId), orderBy: [desc(commentsTable.createdAt)], limit: 100 });
  const enriched = await Promise.all(comments.map(async (c) => {
    const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, c.authorId) });
    return { ...c, createdAt: c.createdAt.toISOString(), author: author ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl } : null };
  }));
  res.json({ comments: enriched });
});

router.post("/:postId/comments", requireAuth, async (req, res) => {
  const postId = Number(req.params["postId"]);
  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
  const [comment] = await db.insert(commentsTable).values({ postId, authorId: req.session!.userId!, content }).returning();
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (post) {
    await db.update(postsTable).set({ commentCount: post.commentCount + 1 }).where(eq(postsTable.id, postId));
    if (post.authorId !== req.session!.userId!) {
      const actor = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
      const actorName = actor?.displayName ?? actor?.username ?? "Someone";
      await db.insert(notificationsTable).values({ userId: post.authorId, actorId: req.session!.userId!, type: "comment", entityId: String(postId), message: `${actorName} commented on your post` });
      sendSseEvent(post.authorId, "new_comment", { postId, actorName });
      sendSseEvent(post.authorId, "new_notification", { notifType: "comment", message: `${actorName} commented on your post`, actorName });
      sendPushToUser(post.authorId, { title: "New comment", body: `${actorName} commented on your post`, tag: `comment-${postId}`, data: { url: "/" } });
    }
  }
  const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  res.status(201).json({ ...comment, createdAt: comment!.createdAt.toISOString(), author: author ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl } : null });
});

export default router;
