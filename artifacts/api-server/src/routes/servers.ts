import { Router } from "express";
import { db } from "../lib/db.js";
import { serversTable, serverMembersTable, channelsTable, channelMessagesTable, serverRolesTable, voicePresenceTable, usersTable, messageReactionsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendSseEvent } from "../lib/sse.js";

const router = Router();

async function serializeServer(s: typeof serversTable.$inferSelect) {
  return { id: s.id, name: s.name, description: s.description, iconUrl: s.iconUrl, ownerId: s.ownerId, memberCount: s.memberCount, tags: (s.tags as string[]) ?? [], createdAt: s.createdAt.toISOString() };
}

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const memberships = await db.query.serverMembersTable.findMany({ where: eq(serverMembersTable.userId, userId) });
  const ids = memberships.map((m) => m.serverId);
  if (ids.length === 0) { res.json({ servers: [] }); return; }
  const servers = await db.query.serversTable.findMany({ where: inArray(serversTable.id, ids) });
  res.json({ servers: await Promise.all(servers.map(serializeServer)) });
});

router.get("/", requireAuth, async (req, res) => {
  const servers = await db.query.serversTable.findMany({ orderBy: [desc(serversTable.memberCount)], limit: 50 });
  res.json({ servers: await Promise.all(servers.map(serializeServer)) });
});

router.post("/", requireAuth, async (req, res) => {
  const { name, description, iconUrl, tags } = req.body as { name: string; description?: string; iconUrl?: string; tags?: string[] };
  const ownerId = req.session!.userId!;
  const [server] = await db.insert(serversTable).values({ name, description: description ?? null, iconUrl: iconUrl ?? null, ownerId, tags: tags ?? [] }).returning();
  await db.insert(serverMembersTable).values({ serverId: server!.id, userId: ownerId });
  await db.insert(channelsTable).values([
    { serverId: server!.id, name: "general", type: "text" },
    { serverId: server!.id, name: "voice", type: "voice" },
  ]);
  res.status(201).json(await serializeServer(server!));
});

router.get("/:serverId", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const server = await db.query.serversTable.findFirst({ where: eq(serversTable.id, serverId) });
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await serializeServer(server));
});

router.post("/:serverId/join", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const userId = req.session!.userId!;
  const existing = await db.query.serverMembersTable.findFirst({ where: and(eq(serverMembersTable.serverId, serverId), eq(serverMembersTable.userId, userId)) });
  if (!existing) {
    await db.insert(serverMembersTable).values({ serverId, userId });
    const s = await db.query.serversTable.findFirst({ where: eq(serversTable.id, serverId) });
    if (s) await db.update(serversTable).set({ memberCount: s.memberCount + 1 }).where(eq(serversTable.id, serverId));
  }
  res.json({ ok: true });
});

router.post("/:serverId/leave", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const userId = req.session!.userId!;
  await db.delete(serverMembersTable).where(and(eq(serverMembersTable.serverId, serverId), eq(serverMembersTable.userId, userId)));
  const s = await db.query.serversTable.findFirst({ where: eq(serversTable.id, serverId) });
  if (s && s.memberCount > 0) await db.update(serversTable).set({ memberCount: s.memberCount - 1 }).where(eq(serversTable.id, serverId));
  res.json({ ok: true });
});

router.get("/:serverId/channels", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const channels = await db.query.channelsTable.findMany({ where: eq(channelsTable.serverId, serverId) });
  res.json({ channels: channels.map((c) => ({ id: c.id, name: c.name, type: c.type })) });
});

router.post("/:serverId/channels", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const { name, type } = req.body as { name: string; type?: string };
  const [channel] = await db.insert(channelsTable).values({ serverId, name, type: type ?? "text" }).returning();
  res.status(201).json({ id: channel!.id, name: channel!.name, type: channel!.type });
});

router.get("/:serverId/channels/:channelId/messages", requireAuth, async (req, res) => {
  const channelId = Number(req.params["channelId"]);
  const msgs = await db.query.channelMessagesTable.findMany({ where: eq(channelMessagesTable.channelId, channelId), orderBy: [desc(channelMessagesTable.createdAt)], limit: 100 });
  const enriched = await Promise.all(msgs.reverse().map(async (m) => {
    const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m.senderId) });
    return { id: m.id, content: m.content, senderId: m.senderId, conversationId: null, groupId: null, createdAt: m.createdAt.toISOString(), sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null };
  }));
  res.json({ messages: enriched });
});

router.post("/:serverId/channels/:channelId/messages", requireAuth, async (req, res) => {
  const channelId = Number(req.params["channelId"]);
  const serverId = Number(req.params["serverId"]);
  const { content } = req.body as { content: string };
  const senderId = req.session!.userId!;
  const [msg] = await db.insert(channelMessagesTable).values({ channelId, senderId, content }).returning();
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, senderId) });
  const members = await db.query.serverMembersTable.findMany({ where: eq(serverMembersTable.serverId, serverId) });
  for (const m of members) {
    if (m.userId !== senderId) sendSseEvent(m.userId, "new_channel_msg", { channelId });
  }
  res.status(201).json({ id: msg!.id, content: msg!.content, senderId: msg!.senderId, conversationId: null, groupId: null, createdAt: msg!.createdAt.toISOString(), sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null });
});

router.get("/:serverId/members", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const memberships = await db.query.serverMembersTable.findMany({ where: eq(serverMembersTable.serverId, serverId) });
  const users = await Promise.all(memberships.map(async (m) => {
    const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m.userId) });
    if (!u) return null;
    return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, customStatus: u.customStatus, isVerified: u.isVerified, joinedAt: m.joinedAt?.toISOString() ?? null };
  }));
  res.json({ members: users.filter(Boolean) });
});

router.delete("/:serverId/members/:userId", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const targetId = req.params["userId"]!;
  const myId = req.session!.userId!;
  const server = await db.query.serversTable.findFirst({ where: eq(serversTable.id, serverId) });
  if (!server || server.ownerId !== myId) { res.status(403).json({ error: "Not the server owner" }); return; }
  if (targetId === myId) { res.status(400).json({ error: "Cannot kick yourself" }); return; }
  await db.delete(serverMembersTable).where(and(eq(serverMembersTable.serverId, serverId), eq(serverMembersTable.userId, String(targetId))));
  if (server.memberCount > 0) await db.update(serversTable).set({ memberCount: server.memberCount - 1 }).where(eq(serversTable.id, serverId));
  res.json({ ok: true });
});

router.get("/:serverId/roles", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const roles = await db.query.serverRolesTable.findMany({ where: eq(serverRolesTable.serverId, serverId) });
  res.json(roles.map(r => ({ id: r.id, serverId: r.serverId, name: r.name, color: r.color, permissions: r.permissions, position: r.position })));
});

router.post("/:serverId/roles", requireAuth, async (req, res) => {
  const serverId = Number(req.params["serverId"]);
  const { name, color, permissions } = req.body as { name: string; color?: string; permissions?: string[] };
  const [r] = await db.insert(serverRolesTable).values({ serverId, name: name ?? "Member", color: color ?? null, permissions: permissions ?? [] }).returning();
  res.json({ id: r!.id, serverId: r!.serverId, name: r!.name, color: r!.color, permissions: r!.permissions });
});

router.post("/channels/:channelId/voice/join", requireAuth, async (req, res) => {
  const channelId = Number(req.params["channelId"]);
  const userId = req.session!.userId!;
  const existing = await db.query.voicePresenceTable.findFirst({ where: and(eq(voicePresenceTable.channelId, channelId), eq(voicePresenceTable.userId, userId)) });
  if (!existing) await db.insert(voicePresenceTable).values({ channelId, userId });
  res.json({ ok: true });
});

router.post("/channels/:channelId/voice/leave", requireAuth, async (req, res) => {
  const channelId = Number(req.params["channelId"]);
  await db.delete(voicePresenceTable).where(and(eq(voicePresenceTable.channelId, channelId), eq(voicePresenceTable.userId, req.session!.userId!)));
  res.json({ ok: true });
});

router.get("/channels/:channelId/voice", requireAuth, async (req, res) => {
  const channelId = Number(req.params["channelId"]);
  const cutoff = new Date(Date.now() - 60000);
  const presence = await db.query.voicePresenceTable.findMany({ where: eq(voicePresenceTable.channelId, channelId) });
  const activePresence = presence.filter(p => p.joinedAt >= cutoff);
  const users = await Promise.all(activePresence.map(async p => {
    const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, p.userId) });
    return u ? { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl } : null;
  }));
  res.json(users.filter(Boolean));
});

router.post("/voice/heartbeat", requireAuth, async (req, res) => {
  res.json({ ok: true });
});

router.delete("/messages/:msgId", requireAuth, async (req, res) => {
  const msgId = Number(req.params["msgId"]);
  const msg = await db.query.channelMessagesTable.findFirst({ where: eq(channelMessagesTable.id, msgId) });
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  if (msg.senderId !== req.session!.userId!) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(channelMessagesTable).where(eq(channelMessagesTable.id, msgId));
  res.json({ ok: true });
});

export default router;
