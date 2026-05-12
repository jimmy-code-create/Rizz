import { Response } from "express";

const clients = new Map<string, Set<Response>>();

export function addSseClient(userId: string, res: Response) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
}

export function removeSseClient(userId: string, res: Response) {
  clients.get(userId)?.delete(res);
}

export function sendSseEvent(userId: string, event: string, data: unknown) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of userClients) {
    try { res.write(payload); } catch { userClients.delete(res); }
  }
}
