import { Router } from "express";
import { db } from "../lib/db.js";
import { callSignalingTable, iceCandidatesTable, conversationParticipantsTable, messagesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendSseEvent } from "../lib/sse.js";
import { sendPushToUser } from "../lib/push.js";

const router = Router();

async function getOtherParticipant(conversationId: number, myId: string): Promise<string | null> {
  const parts = await db.query.conversationParticipantsTable.findMany({ where: eq(conversationParticipantsTable.conversationId, conversationId) });
  return parts.find(p => p.userId !== myId)?.userId ?? null;
}

router.post("/offer", requireAuth, async (req, res) => {
  const { conversationId, sdp, type, callType } = req.body as { conversationId: number; sdp: string; type: string; callType: string };
  const fromUserId = req.session!.userId!;
  const toUserId = await getOtherParticipant(conversationId, fromUserId);
  if (!toUserId) { res.status(400).json({ error: "No other participant" }); return; }

  await db.delete(callSignalingTable).where(eq(callSignalingTable.conversationId, conversationId));
  await db.insert(callSignalingTable).values({ conversationId, fromUserId, toUserId, sdp, type, callType: callType ?? "video" });

  const caller = await db.query.usersTable.findFirst({ where: eq(usersTable.id, fromUserId) });
  const callerName = caller?.displayName ?? caller?.username ?? "Someone";
  const finalCallType = callType ?? "video";

  sendSseEvent(toUserId, "incoming_call", {
    conversationId,
    callType: finalCallType,
    callerId: fromUserId,
    callerName,
    callerAvatar: caller?.avatarUrl ?? null,
  });

  await sendPushToUser(toUserId, {
    title: `📞 Incoming ${finalCallType === "video" ? "video" : "voice"} call`,
    body: `${callerName} is calling you`,
    tag: `call-${conversationId}`,
    data: { url: "/dms" },
  });

  res.json({ ok: true });
});

router.post("/answer", requireAuth, async (req, res) => {
  const { conversationId, sdp, type } = req.body as { conversationId: number; sdp: string; type: string };
  const fromUserId = req.session!.userId!;
  const toUserId = await getOtherParticipant(conversationId, fromUserId);
  if (!toUserId) { res.status(400).json({ error: "No other participant" }); return; }
  await db.insert(callSignalingTable).values({ conversationId, fromUserId, toUserId, sdp, type, callType: "answer" });
  res.json({ ok: true });
});

router.post("/candidate", requireAuth, async (req, res) => {
  const { conversationId, candidate, sdpMid, sdpMLineIndex } = req.body as { conversationId: number; candidate: string; sdpMid?: string; sdpMLineIndex?: number };
  await db.insert(iceCandidatesTable).values({ conversationId, fromUserId: req.session!.userId!, candidate, sdpMid: sdpMid ?? null, sdpMLineIndex: sdpMLineIndex ?? null });
  res.json({ ok: true });
});

router.get("/offer/:conversationId", requireAuth, async (req, res) => {
  const conversationId = Number(req.params["conversationId"]);
  const myId = req.session!.userId!;
  const signal = await db.query.callSignalingTable.findFirst({
    where: and(eq(callSignalingTable.conversationId, conversationId), eq(callSignalingTable.toUserId, myId)),
  });
  if (!signal) { res.json({ offer: null }); return; }
  res.json({ offer: { sdp: signal.sdp, type: signal.type, callType: signal.callType, callerId: signal.fromUserId } });
});

router.get("/answer/:conversationId", requireAuth, async (req, res) => {
  const conversationId = Number(req.params["conversationId"]);
  const myId = req.session!.userId!;
  const signal = await db.query.callSignalingTable.findFirst({
    where: and(eq(callSignalingTable.conversationId, conversationId), eq(callSignalingTable.toUserId, myId)),
  });
  if (!signal) { res.json({ answer: null }); return; }
  res.json({ answer: { sdp: signal.sdp, type: signal.type } });
});

router.get("/candidates/:conversationId", requireAuth, async (req, res) => {
  const conversationId = Number(req.params["conversationId"]);
  const after = req.query["after"] ? Number(req.query["after"]) : 0;
  const userId = req.session!.userId!;
  const all = await db.query.iceCandidatesTable.findMany({ where: eq(iceCandidatesTable.conversationId, conversationId) });
  const filtered = all.filter(c => c.id > after && c.fromUserId !== userId);
  res.json({ candidates: filtered.map(c => ({ candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, timestamp: c.id })) });
});

router.delete("/offer/:conversationId", requireAuth, async (req, res) => {
  const conversationId = Number(req.params["conversationId"]);
  const myId = req.session!.userId!;

  const offer = await db.query.callSignalingTable.findFirst({
    where: eq(callSignalingTable.conversationId, conversationId),
  });

  await db.delete(callSignalingTable).where(eq(callSignalingTable.conversationId, conversationId));
  await db.delete(iceCandidatesTable).where(eq(iceCandidatesTable.conversationId, conversationId));

  if (offer && offer.toUserId === myId) {
    sendSseEvent(offer.fromUserId, "call_declined", { conversationId });
  }

  res.json({ ok: true });
});

router.post("/end", requireAuth, async (req, res) => {
  const { conversationId, callType, wasConnected } = req.body as {
    conversationId: number;
    callType: "voice" | "video";
    wasConnected: boolean;
  };
  const myId = req.session!.userId!;
  const otherId = await getOtherParticipant(conversationId, myId);

  const ct = callType ?? "video";
  const content = wasConnected ? `[call:ended:${ct}]` : `[call:missed:${ct}]`;

  await db.insert(messagesTable).values({ conversationId, senderId: myId, content });

  sendSseEvent(myId, "new_message", { conversationId });
  if (otherId) sendSseEvent(otherId, "new_message", { conversationId });

  res.json({ ok: true });
});

export default router;
