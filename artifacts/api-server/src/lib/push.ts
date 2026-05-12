import { db } from "./db.js";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let vapidConfigured = false;

async function ensureVapid() {
  if (vapidConfigured) return true;
  const pub = process.env["VAPID_PUBLIC_KEY"];
  const priv = process.env["VAPID_PRIVATE_KEY"];
  const email = process.env["VAPID_EMAIL"] ?? "mailto:admin@rizz.app";
  if (!pub || !priv) return false;
  const webpush = await import("web-push");
  webpush.default.setVapidDetails(email, pub, priv);
  vapidConfigured = true;
  return true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; tag?: string; data?: Record<string, unknown> }
) {
  try {
    const ready = await ensureVapid();
    if (!ready) return;
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!user?.pushSubscription) return;
    const webpush = await import("web-push");
    const sub = user.pushSubscription as { endpoint: string; keys: { p256dh: string; auth: string } };
    await webpush.default.sendNotification(sub, JSON.stringify(payload));
  } catch {
    // Push failures are non-critical
  }
}
