import { Router } from "express";
import { db } from "../lib/db.js";
import { postsTable, usersTable, followsTable, likesTable, savesTable, badgesTable, userBadgesTable } from "@workspace/db";
import { eq, and, desc, ne, notInArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const onlineMap = new Map<string, number>();

async function getTopBadge(userId: string) {
  const row = await db
    .select({ badge: badgesTable })
    .from(userBadgesTable)
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.isTop, true)))
    .limit(1);
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
    ...p,
    tags: (p.tags as string[]) ?? [],
    isLiked: !!liked,
    isSaved: !!saved,
    createdAt: p.createdAt.toISOString(),
    author: author
      ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, isVerified: author.isVerified, topBadge }
      : null,
  };
}

// POST /api/presence/heartbeat
router.post("/presence/heartbeat", requireAuth, (req, res) => {
  onlineMap.set(req.session!.userId!, Date.now());
  res.json({ ok: true });
});

// GET /api/presence/online
router.get("/presence/online", requireAuth, (req, res) => {
  const threshold = Date.now() - 3 * 60 * 1000;
  const online = [...onlineMap.entries()]
    .filter(([, ts]) => ts > threshold)
    .map(([id]) => id);
  res.json({ online });
});

// GET /api/hashtag/:tag
router.get("/hashtag/:tag", requireAuth, async (req, res) => {
  const tag = (req.params["tag"] as string).toLowerCase();
  const posts = await db.query.postsTable.findMany({
    where: sql`${postsTable.tags}::text ilike ${"%" + tag + "%"}`,
    orderBy: [desc(postsTable.createdAt)],
    limit: 50,
  });
  const enriched = await Promise.all(posts.map((p) => enrichPost(p, req.session!.userId!)));
  res.json({ tag, posts: enriched, count: enriched.length });
});

// GET /api/leaderboard
router.get("/leaderboard", requireAuth, async (req, res) => {
  const users = await db.query.usersTable.findMany({
    where: eq(usersTable.isBanned, false),
    orderBy: [desc(usersTable.followerCount), desc(usersTable.rizzScore)],
    limit: 25,
  });
  const enriched = await Promise.all(
    users.map(async (u, i) => {
      const topBadge = await getTopBadge(u.id);
      return {
        rank: i + 1,
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        isVerified: u.isVerified,
        followerCount: u.followerCount,
        followingCount: u.followingCount,
        rizzScore: u.rizzScore,
        postCount: u.postCount,
        topBadge,
        isOnline: (onlineMap.get(u.id) ?? 0) > Date.now() - 3 * 60 * 1000,
      };
    }),
  );
  res.json({ users: enriched });
});

// GET /api/suggestions
router.get("/suggestions", requireAuth, async (req, res) => {
  const myId = req.session!.userId!;
  const following = await db
    .select({ id: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, myId));
  const followingIds = following.map((f) => f.id);

  const users = await db.query.usersTable.findMany({
    where: and(
      ne(usersTable.id, myId),
      eq(usersTable.isBanned, false),
      followingIds.length > 0 ? notInArray(usersTable.id, followingIds) : undefined,
    ),
    orderBy: [desc(usersTable.followerCount), desc(usersTable.rizzScore)],
    limit: 12,
  });

  const enriched = await Promise.all(
    users.map(async (u) => {
      const topBadge = await getTopBadge(u.id);
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        isVerified: u.isVerified,
        followerCount: u.followerCount,
        bio: u.bio,
        topBadge,
        isOnline: (onlineMap.get(u.id) ?? 0) > Date.now() - 3 * 60 * 1000,
      };
    }),
  );
  res.json({ users: enriched });
});

export { onlineMap };
export default router;
