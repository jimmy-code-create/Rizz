import { Router } from "express";
import { db } from "../lib/db.js";
import { groupsTable, groupMembersTable, groupMessagesTable, usersTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendSseEvent } from "../lib/sse.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const memberships = await db.query.groupMembersTable.findMany({ where: eq(groupMembersTable.userId, userId) });
  const groupIds = memberships.map((m) => m.groupId);
  if (groupIds.length === 0) { res.json({ groups: [] }); return; }
  const groups = await db.query.groupsTable.findMany({ where: inArray(groupsTable.id, groupIds) });
  res.json({ groups: groups.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })) });
});

router.post("/", requireAuth, async (req, res) => {
  const { name } = req.body as { name: string };
  const userId = req.session!.userId!;
  const [group] = await db.insert(groupsTable).values({ name, ownerId: userId }).returning();
  await db.insert(groupMembersTable).values({ groupId: group!.id, userId });
  res.status(201).json({ ...group, createdAt: group!.createdAt.toISOString() });
});

router.get("/:id/messages", requireAuth, async (req, res) => {
  const groupId = Number(req.params["id"]);
  const msgs = await db.query.groupMessagesTable.findMany({
    where: eq(groupMessagesTable.groupId, groupId),
    orderBy: [desc(groupMessagesTable.createdAt)],
    limit: 100,
  });
  const enriched = await Promise.all(msgs.reverse().map(async (m) => {
    const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m.senderId) });
    return { ...m, createdAt: m.createdAt.toISOString(), sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null };
  }));
  res.json({ messages: enriched });
});

router.post("/:id/messages", requireAuth, async (req, res) => {
  const groupId = Number(req.params["id"]);
  const { content } = req.body as { content: string };
  const senderId = req.session!.userId!;
  const [msg] = await db.insert(groupMessagesTable).values({ groupId, senderId, content }).returning();
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, senderId) });
  const members = await db.query.groupMembersTable.findMany({ where: eq(groupMembersTable.groupId, groupId) });
  for (const m of members) {
    if (m.userId !== senderId) sendSseEvent(m.userId, "new_group_msg", { groupId });
  }
  res.status(201).json({ ...msg, createdAt: msg!.createdAt.toISOString(), sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null });
});

export default router;
