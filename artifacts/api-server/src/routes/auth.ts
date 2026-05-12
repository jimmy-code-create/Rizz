import { Router } from "express";
import { db } from "../lib/db.js";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const router = Router();

function serializeUser(u: typeof usersTable.$inferSelect, extra?: { isFollowing?: boolean }) {
  const isOnline = u.lastSeenAt != null && (Date.now() - u.lastSeenAt.getTime()) < 3 * 60 * 1000;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    bannerUrl: u.bannerUrl,
    isVerified: u.isVerified,
    isAdmin: u.isAdmin,
    rizzScore: u.rizzScore,
    followerCount: u.followerCount,
    followingCount: u.followingCount,
    postCount: u.postCount,
    onboardingCompleted: u.onboardingCompleted,
    customStatus: u.customStatus,
    dnd: u.dnd,
    interests: (u.interests as string[]) ?? [],
    isFollowing: extra?.isFollowing ?? false,
    isOnline,
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
  };
}

router.post("/register", async (req, res) => {
  const { username, email, password, displayName } = req.body as { username: string; email: string; password: string; displayName?: string };
  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email and password required" });
    return;
  }
  const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
  if (existing) { res.status(409).json({ error: "Email already registered" }); return; }
  const usernameExists = await db.query.usersTable.findFirst({ where: eq(usersTable.username, username) });
  if (usernameExists) { res.status(409).json({ error: "Username already taken" }); return; }
  const passwordHash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const [user] = await db.insert(usersTable).values({
    id, username, email, passwordHash, displayName: displayName ?? username,
  }).returning();
  req.session!.userId = id;
  res.json(serializeUser(user!));
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) { res.status(400).json({ error: "username and password required" }); return; }
  const user = await db.query.usersTable.findFirst({
    where: or(eq(usersTable.username, username), eq(usersTable.email, username)),
  });
  if (!user || !user.passwordHash) { res.status(401).json({ error: "Invalid credentials" }); return; }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Invalid credentials" }); return; }
  if (user.isBanned) { res.status(403).json({ error: "Account banned" }); return; }
  req.session!.userId = user.id;
  res.json(serializeUser(user));
});

router.post("/logout", async (req, res) => {
  req.session?.destroy?.(() => {});
  res.json({ ok: true });
});

router.post("/guest", async (req, res) => {
  const { guestId } = req.body as { guestId?: string };
  let userId = guestId;
  let user = userId ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) }) : null;
  if (!user) {
    userId = randomUUID();
    const guestNum = Math.floor(Math.random() * 99999);
    const username = `guest_${guestNum}`;
    const [newUser] = await db.insert(usersTable).values({
      id: userId, username, displayName: `Guest ${guestNum}`,
      email: `${userId}@guest.rizz`, passwordHash: null, onboardingCompleted: true,
    }).returning();
    user = newUser!;
  }
  req.session!.userId = user.id;
  res.json({ guestId: user.id, ...serializeUser(user) });
});

export { serializeUser };
export default router;
