import { Router } from "express";
import { db } from "../lib/db.js";
import { conversationsTable, conversationParticipantsTable, messagesTable, usersTable, messageReactionsTable, blocksTable } from "@workspace/db";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { addSseClient, removeSseClient, sendSseEvent } from "../lib/sse.js";
import { sendPushToUser } from "../lib/push.js";

const router = Router();

// SSE endpoint
router.get("/events", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`: connected\n\n`);
  const userId = req.session!.userId!;
  addSseClient(userId, res);
  const heartbeat = setInterval(() => { try { res.write(`: ping\n\n`); } catch { clearInterval(heartbeat); } }, 25000);
  req.on("close", () => { clearInterval(heartbeat); removeSseClient(userId, res); });
});

async function getParticipants(convId: number) {
  const parts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.conversationId, convId) });
  return Promise.all(parts.map(async (p) => {
    const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, p.userId) });
    return u ? { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl } : null;
  })).then((r) => r.filter(Boolean));
}

// GET /api/dm/conversations
router.get("/conversations", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const myParts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.userId, userId) });
  const convIds = myParts.map((p) => p.conversationId);
  if (convIds.length === 0) { res.json({ conversations: [] }); return; }
  const convs = await db.query.conversationsTable.findMany({ where: inArray(conversationsTable.id, convIds), orderBy: [desc(conversationsTable.createdAt)] });
  const enriched = await Promise.all(convs.map(async (c) => {
    const participants = await getParticipants(c.id);
    const lastMsg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.conversationId, c.id), orderBy: [desc(messagesTable.createdAt)] });
    // Unread count for current user
    const { sql } = await import("drizzle-orm");
    return {
      ...c,
      createdAt: c.createdAt.toISOString(),
      participants,
      lastMessage: lastMsg ? { content: lastMsg.content, createdAt: lastMsg.createdAt.toISOString(), senderId: lastMsg.senderId } : null,
    };
  }));
  res.json({ conversations: enriched });
});

// POST /api/dm/conversations
router.post("/conversations", requireAuth, async (req, res) => {
  const { userId } = req.body as { userId: string };
  const myId = req.session!.userId!;
  const myConvs = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.userId, myId) });
  for (const cp of myConvs) {
    const other = await db.query.conversationParticipantsTable.findFirst({
      where: and(eq(conversationParticipantsTable.conversationId, cp.conversationId), eq(conversationParticipantsTable.userId, userId)),
    });
    if (other) {
      const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, cp.conversationId) });
      if (conv) {
        const participants = await getParticipants(conv.id);
        res.json({ ...conv, createdAt: conv.createdAt.toISOString(), participants, lastMessage: null });
        return;
      }
    }
  }
  const [conv] = await db.insert(conversationsTable).values({}).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv!.id, userId: myId },
    { conversationId: conv!.id, userId },
  ]);
  const participants = await getParticipants(conv!.id);
  res.json({ ...conv, createdAt: conv!.createdAt.toISOString(), participants, lastMessage: null });
});

// GET /api/dm/conversations/:id/messages
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const convId = Number(req.params["id"]);
  const userId = req.session!.userId!;
  const msgs = await db.query.messagesTable.findMany({
    where: eq(messagesTable.conversationId, convId),
    orderBy: [desc(messagesTable.createdAt)],
    limit: 100,
  });
  const enriched = await Promise.all(msgs.reverse().map(async (m) => {
    const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m.senderId) });
    const reactionRows = await db.query.messageReactionsTable.findMany({ where: eq(messageReactionsTable.messageId, m.id) });
    const reactionMap = new Map<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }>();
    for (const r of reactionRows) {
      const ex = reactionMap.get(r.emoji);
      if (ex) { ex.count++; ex.users.push(r.userId); if (r.userId === userId) ex.hasReacted = true; }
      else reactionMap.set(r.emoji, { emoji: r.emoji, count: 1, users: [r.userId], hasReacted: r.userId === userId });
    }
    return {
      ...m,
      createdAt: m.createdAt.toISOString(),
      sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null,
      reactions: Array.from(reactionMap.values()),
    };
  }));
  res.json({ messages: enriched });
});

// POST /api/dm/conversations/:id/seen — mark all messages in conversation as seen
router.post("/conversations/:id/seen", requireAuth, async (req, res) => {
  const convId = Number(req.params["id"]);
  const userId = req.session!.userId!;
  const now = new Date();
  // Notify the other party via SSE that their messages have been seen
  const parts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.conversationId, convId) });
  for (const p of parts) {
    if (p.userId !== userId) {
      sendSseEvent(p.userId, "messages_seen", { conversationId: convId, seenBy: userId, seenAt: now.toISOString() });
    }
  }
  res.json({ ok: true });
});

// POST /api/dm/conversations/:id/typing
router.post("/conversations/:id/typing", requireAuth, async (req, res) => {
  const convId = Number(req.params["id"]);
  const senderId = req.session!.userId!;
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, senderId) });
  const parts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.conversationId, convId) });
  for (const p of parts) {
    if (p.userId !== senderId) {
      sendSseEvent(p.userId, "typing", { conversationId: convId, userId: senderId, name: sender?.displayName ?? sender?.username ?? "Someone" });
    }
  }
  res.json({ ok: true });
});

// POST /api/dm/conversations/:id/messages
router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const convId = Number(req.params["id"]);
  const { content } = req.body as { content: string };
  const senderId = req.session!.userId!;

  // Check if sender is blocked by the other party
  const parts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.conversationId, convId) });
  for (const p of parts) {
    if (p.userId !== senderId) {
      const blocked = await db.select().from(blocksTable).where(and(eq(blocksTable.blockerId, p.userId), eq(blocksTable.blockedId, senderId))).limit(1);
      if (blocked.length) { res.status(403).json({ error: "blocked" }); return; }
      // Also check if sender blocked the other
      const senderBlocked = await db.select().from(blocksTable).where(and(eq(blocksTable.blockerId, senderId), eq(blocksTable.blockedId, p.userId))).limit(1);
      if (senderBlocked.length) { res.status(403).json({ error: "blocked" }); return; }
    }
  }

  const [msg] = await db.insert(messagesTable).values({ conversationId: convId, senderId, content }).returning();
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, senderId) });
  const participants = await getParticipants(convId);
  const senderName = sender?.displayName ?? sender?.username ?? "Someone";
  const preview = content.length > 60 ? content.slice(0, 57) + "…" : content;
  for (const p of participants) {
    if (p && p.id !== senderId) {
      sendSseEvent(p.id, "new_message", { conversationId: convId });
      sendPushToUser(p.id, { title: senderName, body: preview, tag: `dm-${convId}`, data: { url: "/dms" } });
    }
  }
  res.status(201).json({
    ...msg,
    createdAt: msg!.createdAt.toISOString(),
    sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null,
    reactions: [],
  });
});

// DELETE /api/dm/messages/:id
router.delete("/messages/:id", requireAuth, async (req, res) => {
  const msgId = Number(req.params["id"]);
  const userId = req.session!.userId!;
  const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, msgId) });
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  if (msg.senderId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(messagesTable).set({ isDeleted: true, content: "This message was deleted" }).where(eq(messagesTable.id, msgId));
  const parts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.conversationId, msg.conversationId) });
  for (const p of parts) {
    sendSseEvent(p.userId, "new_message", { conversationId: msg.conversationId });
  }
  res.json({ ok: true });
});

// POST /api/dm/messages/:messageId/react
router.post("/messages/:messageId/react", requireAuth, async (req, res) => {
  const messageId = Number(req.params["messageId"]);
  const { emoji } = req.body as { emoji: string };
  const userId = req.session!.userId!;
  const existing = await db.query.messageReactionsTable.findFirst({ where: and(eq(messageReactionsTable.messageId, messageId), eq(messageReactionsTable.userId, userId), eq(messageReactionsTable.emoji, emoji)) });
  if (existing) {
    await db.delete(messageReactionsTable).where(eq(messageReactionsTable.id, existing.id));
  } else {
    await db.insert(messageReactionsTable).values({ messageId, userId, emoji });
  }
  // Broadcast to conversation participants
  const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
  if (msg) {
    const parts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.conversationId, msg.conversationId) });
    for (const p of parts) {
      sendSseEvent(p.userId, "reaction_update", { messageId, conversationId: msg.conversationId });
    }
  }
  res.json({ ok: true, removed: !!existing });
});

export default router;
