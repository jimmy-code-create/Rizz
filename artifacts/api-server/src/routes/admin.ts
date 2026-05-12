import { Router } from "express";
import { db } from "../lib/db.js";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /api/admin/check — returns whether current user is admin
router.get("/check", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  res.json({ isAdmin: user?.isAdmin ?? false });
});

// POST /api/admin/owner-login — login as admin using regular credentials
router.post("/owner-login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) { res.status(400).json({ error: "username and password required" }); return; }
  const user = await db.query.usersTable.findFirst({
    where: or(eq(usersTable.username, username), eq(usersTable.email, username)),
  });
  if (!user || !user.passwordHash) { res.status(401).json({ error: "Invalid credentials" }); return; }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Invalid credentials" }); return; }
  if (!user.isAdmin) { res.status(403).json({ error: "Not an admin account" }); return; }
  req.session!.userId = user.id;
  res.json({ ok: true, username: user.username });
});

// GET /api/admin/users — list all users (admin only)
router.get("/users", requireAuth, async (req, res) => {
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  if (!me?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const users = await db.query.usersTable.findMany({ limit: 200 });
  res.json({ users: users.map(u => ({ id: u.id, username: u.username, email: u.email, displayName: u.displayName, isAdmin: u.isAdmin, isBanned: u.isBanned, createdAt: u.createdAt })) });
});

// POST /api/admin/users/:id/ban — ban a user
router.post("/users/:id/ban", requireAuth, async (req, res) => {
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  if (!me?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const targetId = String(req.params["id"]);
  await db.update(usersTable).set({ isBanned: true }).where(eq(usersTable.id, targetId));
  res.json({ ok: true });
});

// POST /api/admin/users/:id/unban — unban a user
router.post("/users/:id/unban", requireAuth, async (req, res) => {
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  if (!me?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const targetId = String(req.params["id"]);
  await db.update(usersTable).set({ isBanned: false }).where(eq(usersTable.id, targetId));
  res.json({ ok: true });
});

// POST /api/admin/users/:id/verify — give verified badge
router.post("/users/:id/verify", requireAuth, async (req, res) => {
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  if (!me?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const targetId = String(req.params["id"]);
  await db.update(usersTable).set({ isVerified: true }).where(eq(usersTable.id, targetId));
  res.json({ ok: true });
});

export default router;
