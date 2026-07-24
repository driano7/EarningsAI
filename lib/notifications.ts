/*
 * Quartly Bot — lib/notifications.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  chatId: string;
  createdAt: number;
}

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = "mailto:quartly@bot.app";

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function savePushSubscription(chatId: string, subscription: PushSubscription): Promise<void> {
  const key = `push:subs:${chatId}`;
  await kv.set(key, subscription, { ex: 365 * 86400 });
}

export async function getPushSubscription(chatId: string): Promise<PushSubscription | null> {
  const key = `push:subs:${chatId}`;
  return await kv.get<PushSubscription>(key);
}

export async function removePushSubscription(chatId: string): Promise<void> {
  const key = `push:subs:${chatId}`;
  await kv.del(key);
}

export async function getAllPushSubscriptions(): Promise<PushSubscription[]> {
  try {
    const pattern = "push:subs:*";
    const keys = await kv.keys(pattern);
    const subs = await Promise.all(
      keys.map(async (key) => {
        const sub = await kv.get<PushSubscription>(key);
        return sub;
      })
    );
    return subs.filter((s): s is PushSubscription => s !== null);
  } catch {
    return [];
  }
}

async function sendWebPush(subscription: PushSubscription, payload: NotificationPayload): Promise<boolean> {
  if (!VAPID_PRIVATE_KEY) return false;

  try {
    const webPush = await import("web-push");
    webPush.default.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag || "quartly",
      url: payload.url || "/dashboard",
      icon: payload.icon,
    });

    await webPush.default.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      body
    );
    return true;
  } catch (err: unknown) {
    const error = err as { statusCode?: number };
    if (error.statusCode === 404 || error.statusCode === 410) {
      return false;
    }
    console.error("Push notification error:", err);
    return false;
  }
}

export async function sendPushToUser(chatId: string, payload: NotificationPayload): Promise<boolean> {
  const sub = await getPushSubscription(chatId);
  if (!sub) return false;
  return sendWebPush(sub, payload);
}

export async function broadcastPush(payload: NotificationPayload): Promise<{ sent: number; failed: number }> {
  const subs = await getAllPushSubscriptions();
  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    const ok = await sendWebPush(sub, payload);
    if (ok) sent++;
    else failed++;
  }

  return { sent, failed };
}

export async function sendEarningsReminder(
  chatId: string,
  tickers: Array<{ ticker: string; name: string; date: string }>
): Promise<boolean> {
  if (tickers.length === 0) return false;

  const tickerList = tickers.map((t) => t.ticker).join(", ");
  const dayWord = tickers.length === 1 ? "dia" : "dias";
  const names = tickers.map((t) => `${t.ticker} (${t.name})`).join(", ");

  return sendPushToUser(chatId, {
    title: `Reportes en 2 ${dayWord}: ${tickerList}`,
    body: `Tus acciones reportan pronto: ${names}. Prepárate.`,
    tag: `earnings-${tickers[0].date}`,
    url: "/dashboard/calendar",
  });
}

export async function sendSupernotaNotification(chatId: string): Promise<boolean> {
  return sendPushToUser(chatId, {
    title: "Tu Supernota está lista",
    body: "El resumen diario del mercado está listo. Ábrelo para ver el análisis.",
    tag: "supernota",
    url: "/dashboard/news",
  });
}
