/*
 * Quartly Bot — api/cron-news.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { env } from "../lib/env";
import { getAllUsers } from "../lib/kv";
import { generateDailyNewsSummary } from "../lib/news-summary";
import { sendMessage } from "../lib/telegram";

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const users = await getAllUsers();
  if (users.length === 0) {
    return res.status(200).json({ ok: true, message: "No users" });
  }

  let sent = 0;
  let failed = 0;

  for (const chatId of users) {
    try {
      const summary = await generateDailyNewsSummary(chatId);
      await sendMessage(chatId, summary);
      sent++;
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      failed++;
      console.error(`Error sending supernota to ${chatId}:`, err);
    }
  }

  return res.status(200).json({ ok: true, sent, failed, total: users.length });
}
