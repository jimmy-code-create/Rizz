import { Router } from "express";
import { db } from "../lib/db.js";
import { usersTable, followsTable, userBadgesTable, badgesTable, blocksTable } from "@workspace/db";
import { eq, and, ne, or, ilike, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { serializeUser } from "./auth.js";
import { sendSseEvent } from "../lib/sse.js";
import { sendPushToUser } from "../lib/push.js";
import { notificationsTable } from "@workspace/db";

const router = Router();

async function getUserWithTopBadge(userId: string, viewerId?: string) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return null;
  let isFollowing = false;
  let isFollowingBack = false;
  let isBlocked = false;
  if (viewerId && viewerId !== userId) {
    const [followRows, followBackRows, blockRows] = await Promise.all([
      db.select().from(followsTable).where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, userId))).limit(1),
      db.select().from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, viewerId))).limit(1),
      db.select().from(blocksTable).where(and(eq(blocksTable.blockerId, viewerId), eq(blocksTable.blockedId, userId))).limit(1),
    ]);
    isFollowing = followRows.length > 0;
    isFollowingBack = followBackRows.length > 0;
    isBlocked = blockRows.length > 0;
  }
  const topBadgeRow = await db
    .select({ badge: badgesTable })
    .from(userBadgesTable)
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.isTop, true)))
    .limit(1);
  const topBadge = topBadgeRow[0]?.badge ?? null;
  return { ...serializeUser(user, { isFollowing }), isFollowingBack, isBlocked, topBadge };
}

// GET /api/users/me
router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserWithTopBadge(req.session!.userId!, req.session!.userId!);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

// PATCH /api/users/me
router.patch("/me", requireAuth, async (req, res) => {
  const { displayName, bio, avatarUrl, bannerUrl, interests } = req.body as {
    displayName?: string; bio?: string; avatarUrl?: string; bannerUrl?: string; interests?: string[];
  };
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (bio !== undefined) updates.bio = bio;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;
  if (interests !== undefined) updates.interests = interests;
  updates.updatedAt = new Date();
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.session!.userId!)).returning();
  const full = await getUserWithTopBadge(user!.id, user!.id);
  res.json(full);
});

// POST /api/users/me/heartbeat — marks user as online (call every 30s)
router.post("/me/heartbeat", requireAuth, async (req, res) => {
  await db.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, req.session!.userId!));
  res.json({ ok: true });
});

// GET /api/users/online — returns set of online user IDs (seen in last 3 min)
router.get("/online", requireAuth, async (req, res) => {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000);
  const { gt } = await import("drizzle-orm");
  const rows = await db.select({ id: usersTable.id }).from(usersTable).where(gt(usersTable.lastSeenAt, cutoff));
  res.json({ onlineIds: rows.map(r => r.id) });
});

// PUT /api/users/me/status
router.put("/me/status", requireAuth, async (req, res) => {
  const { status, dnd } = req.body as { status?: string | null; dnd?: boolean };
  const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
  if (status !== undefined) updates.customStatus = status;
  if (dnd !== undefined) updates.dnd = dnd;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.session!.userId!)).returning();
  res.json(serializeUser(user!));
});

// POST /api/users/me/onboarding
router.post("/me/onboarding", requireAuth, async (req, res) => {
  const { displayName, username, bio, interests, avatarUrl } = req.body as {
    displayName?: string; username?: string; bio?: string; interests?: string[]; avatarUrl?: string;
  };
  const updates: Partial<typeof usersTable.$inferInsert> = { onboardingCompleted: true, updatedAt: new Date() };
  if (displayName) updates.displayName = displayName;
  if (username) updates.username = username;
  if (bio) updates.bio = bio;
  if (interests) updates.interests = interests;
  if (avatarUrl) updates.avatarUrl = avatarUrl;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.session!.userId!)).returning();
  res.json(serializeUser(user!));
});

// GET /api/users/me/blocked
router.get("/me/blocked", requireAuth, async (req, res) => {
  const myId = req.session!.userId!;
  const blocks = await db.select().from(blocksTable).where(eq(blocksTable.blockerId, myId));
  const users = await Promise.all(blocks.map(async (b) => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, b.blockedId)).limit(1);
    return u ? { ...serializeUser(u), blockedAt: b.createdAt.toISOString() } : null;
  }));
  res.json({ blocked: users.filter(Boolean) });
});

// GET /api/users/search
router.get("/search", requireAuth, async (req, res) => {
  const q = (req.query["q"] as string) ?? "";
  if (!q) { res.json({ users: [] }); return; }
  const results = await db.select().from(usersTable).where(
    and(
      or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.displayName, `%${q}%`)),
      ne(usersTable.id, req.session!.userId!),
    )
  ).limit(20);
  res.json({ users: results.map((u) => serializeUser(u)) });
});

// GET /api/users/:userId/followers — list of people who follow target
router.get("/:userId/followers", requireAuth, async (req, res) => {
  const targetId = String(req.params["userId"]);
  const myId = req.session!.userId!;
  const rows = await db.select({ followerId: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.followingId, targetId));
  const ids = rows.map((r) => r.followerId);
  if (!ids.length) { res.json({ users: [] }); return; }
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, ids));
  const withFollowing = await Promise.all(users.map(async (u) => {
    const isFollowing = (await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, myId), eq(followsTable.followingId, u.id))).limit(1)).length > 0;
    return { ...serializeUser(u), isFollowing };
  }));
  res.json({ users: withFollowing });
});

// GET /api/users/:userId/following — list of people target follows
router.get("/:userId/following", requireAuth, async (req, res) => {
  const targetId = String(req.params["userId"]);
  const myId = req.session!.userId!;
  const rows = await db.select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, targetId));
  const ids = rows.map((r) => r.followingId);
  if (!ids.length) { res.json({ users: [] }); return; }
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, ids));
  const withFollowing = await Promise.all(users.map(async (u) => {
    const isFollowing = (await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, myId), eq(followsTable.followingId, u.id))).limit(1)).length > 0;
    const isFollowingBack = (await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, u.id), eq(followsTable.followingId, myId))).limit(1)).length > 0;
    return { ...serializeUser(u), isFollowing, isFollowingBack, isFriend: isFollowing && isFollowingBack };
  }));
  res.json({ users: withFollowing });
});

// GET /api/users/:userId/friends — mutual follows (both follow each other)
router.get("/:userId/friends", requireAuth, async (req, res) => {
  const targetId = String(req.params["userId"]);
  const myId = req.session!.userId!;
  // Who target follows
  const targetFollowing = await db.select({ followingId: followsTable.followingId })
    .from(followsTable).where(eq(followsTable.followerId, targetId));
  const targetFollowingIds = targetFollowing.map((r) => r.followingId);
  if (!targetFollowingIds.length) { res.json({ users: [] }); return; }
  // Who follows target back (mutual)
  const mutual = await db.select({ followerId: followsTable.followerId })
    .from(followsTable)
    .where(and(
      eq(followsTable.followingId, targetId),
      inArray(followsTable.followerId, targetFollowingIds),
    ));
  const mutualIds = mutual.map((r) => r.followerId);
  if (!mutualIds.length) { res.json({ users: [] }); return; }
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, mutualIds));
  const withMeta = await Promise.all(users.map(async (u) => {
    const isFollowing = myId === targetId ? true : (await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, myId), eq(followsTable.followingId, u.id))).limit(1)).length > 0;
    return { ...serializeUser(u), isFollowing, isFriend: true };
  }));
  res.json({ users: withMeta });
});

// GET /api/users/:userId
router.get("/:userId", requireAuth, async (req, res) => {
  const user = await getUserWithTopBadge(String(req.params["userId"]), req.session?.userId);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

// GET /api/users/:userId/posts
router.get("/:userId/posts", requireAuth, async (req, res) => {
  const { postsTable: pt, likesTable: lt, savesTable: st } = await import("@workspace/db");
  const { desc } = await import("drizzle-orm");
  const targetUserId = String(req.params["userId"]);
  const posts = await db.select().from(pt).where(eq(pt.authorId, targetUserId)).orderBy(desc(pt.createdAt)).limit(50);
  const userId = req.session!.userId!;
  const enriched = await Promise.all(posts.map(async (p) => {
    const [likedRows, savedRows, author] = await Promise.all([
      db.select().from(lt).where(and(eq(lt.userId, userId), eq(lt.postId, p.id))).limit(1),
      db.select().from(st).where(and(eq(st.userId, userId), eq(st.postId, p.id))).limit(1),
      getUserWithTopBadge(p.authorId, userId),
    ]);
    return { ...p, tags: (p.tags as string[]) ?? [], isLiked: likedRows.length > 0, isSaved: savedRows.length > 0, author, createdAt: p.createdAt.toISOString() };
  }));
  res.json({ posts: enriched });
});

// GET /api/users/:userId/badges
router.get("/:userId/badges", requireAuth, async (req, res) => {
  const targetUserId = String(req.params["userId"]);
  const rows = await db
    .select({ badge: badgesTable, earnedAt: userBadgesTable.earnedAt, isTop: userBadgesTable.isTop })
    .from(userBadgesTable)
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(eq(userBadgesTable.userId, targetUserId));
  res.json({ badges: rows.map((r) => ({ ...r.badge, earnedAt: r.earnedAt.toISOString(), owned: true })) });
});

// GET /api/users/:userId/mutuals
router.get("/:userId/mutuals", requireAuth, async (req, res) => {
  const myId = req.session!.userId!;
  const targetId = String(req.params["userId"]);
  const iFollow = await db.select({ followingId: followsTable.followingId }).from(followsTable).where(eq(followsTable.followerId, myId));
  const iFollowIds = iFollow.map((f) => f.followingId);
  if (!iFollowIds.length) { res.json({ mutuals: [] }); return; }
  const targetFollows = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(and(eq(followsTable.followerId, targetId), inArray(followsTable.followingId, iFollowIds)));
  const mutualIds = targetFollows.map((f) => f.followingId).filter((id) => id !== myId && id !== targetId);
  if (!mutualIds.length) { res.json({ mutuals: [] }); return; }
  const mutualUsers = await db.select().from(usersTable).where(inArray(usersTable.id, mutualIds.slice(0, 6)));
  res.json({ mutuals: mutualUsers.map((u) => serializeUser(u)) });
});

// POST /api/users/:userId/follow
router.post("/:userId/follow", requireAuth, async (req, res) => {
  const followerId = req.session!.userId!;
  const followingId = String(req.params["userId"]);
  if (followerId === followingId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }
  const existing = await db.select().from(followsTable).where(and(eq(followsTable.followerId, followerId), eq(followsTable.followingId, followingId))).limit(1);
  if (!existing.length) {
    await db.insert(followsTable).values({ followerId, followingId });
    const [followingUser] = await db.select().from(usersTable).where(eq(usersTable.id, followingId)).limit(1);
    const [followerUser] = await db.select().from(usersTable).where(eq(usersTable.id, followerId)).limit(1);
    if (followingUser) await db.update(usersTable).set({ followerCount: followingUser.followerCount + 1 }).where(eq(usersTable.id, followingId));
    if (followerUser) await db.update(usersTable).set({ followingCount: followerUser.followingCount + 1 }).where(eq(usersTable.id, followerId));
    const actorName = followerUser?.displayName ?? followerUser?.username ?? "Someone";
    await db.insert(notificationsTable).values({ userId: followingId, actorId: followerId, type: "follow", message: `${actorName} started following you` });
    sendSseEvent(followingId, "new_follow", { actorName });
    sendSseEvent(followingId, "new_notification", { notifType: "follow", message: `${actorName} started following you`, actorName });
    sendPushToUser(followingId, { title: "New follower", body: `${actorName} started following you`, tag: `follow-${followerId}`, data: { url: `/profile/${followerId}` } });
  }
  res.json({ ok: true });
});

// POST /api/users/:userId/unfollow
router.post("/:userId/unfollow", requireAuth, async (req, res) => {
  const followerId = req.session!.userId!;
  const followingId = String(req.params["userId"]);
  await db.delete(followsTable).where(and(eq(followsTable.followerId, followerId), eq(followsTable.followingId, followingId)));
  const [followerUser] = await db.select().from(usersTable).where(eq(usersTable.id, followerId)).limit(1);
  const [followingUser] = await db.select().from(usersTable).where(eq(usersTable.id, followingId)).limit(1);
  if (followerUser && followerUser.followingCount > 0)
    await db.update(usersTable).set({ followingCount: followerUser.followingCount - 1 }).where(eq(usersTable.id, followerId));
  if (followingUser && followingUser.followerCount > 0)
    await db.update(usersTable).set({ followerCount: followingUser.followerCount - 1 }).where(eq(usersTable.id, followingId));
  res.json({ ok: true });
});

// POST /api/users/:userId/block
router.post("/:userId/block", requireAuth, async (req, res) => {
  const blockerId = req.session!.userId!;
  const blockedId = String(req.params["userId"]);
  if (blockerId === blockedId) { res.status(400).json({ error: "Cannot block yourself" }); return; }
  const existing = await db.select().from(blocksTable).where(and(eq(blocksTable.blockerId, blockerId), eq(blocksTable.blockedId, blockedId))).limit(1);
  if (!existing.length) {
    await db.insert(blocksTable).values({ blockerId, blockedId });
    await db.delete(followsTable).where(and(eq(followsTable.followerId, blockerId), eq(followsTable.followingId, blockedId)));
    await db.delete(followsTable).where(and(eq(followsTable.followerId, blockedId), eq(followsTable.followingId, blockerId)));
  }
  res.json({ ok: true });
});

// DELETE /api/users/:userId/block (unblock)
router.delete("/:userId/block", requireAuth, async (req, res) => {
  const blockerId = req.session!.userId!;
  const blockedId = String(req.params["userId"]);
  await db.delete(blocksTable).where(and(eq(blocksTable.blockerId, blockerId), eq(blocksTable.blockedId, blockedId)));
  res.json({ ok: true });
});

// GET /api/users/:userId/block-status — check if current user has blocked this user
router.get("/:userId/block-status", requireAuth, async (req, res) => {
  const blockerId = req.session!.userId!;
  const blockedId = String(req.params["userId"]);
  const block = await db.query.blocksTable.findFirst({ where: and(eq(blocksTable.blockerId, blockerId), eq(blocksTable.blockedId, blockedId)) });
  res.json({ isBlocked: !!block });
});

export { getUserWithTopBadge };
export default router;
