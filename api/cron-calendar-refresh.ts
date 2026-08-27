/*
 * Quartly Bot — api/cron-calendar-refresh.ts
 * Cada 10 días: refresca calendario earnings + regenera supernota con mismo OpenRouter request (news + fred + earnings)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { env } from "../lib/env";
import { getAllUsers } from "../lib/kv";
import { generateDailyNewsSummary } from "../lib/news-summary";

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const users = await getAllUsers();
  // Reusa cron-earnings lógica vía fetch interno
  try {
    const base = `https://${process.env.VERCEL_URL || "earnings-ai-one.vercel.app"}`;
    await fetch(`${base}/api/cron-earnings`, { headers: { "x-cron-secret": env.CRON_SECRET } }).catch(()=>{});
  } catch {}

  let generated = 0;
  for (const chatId of users) {
    try {
      await generateDailyNewsSummary(chatId);
      generated++;
      await new Promise(r=>setTimeout(r, 800));
    } catch (e) { console.error("calendar-refresh supernota fail", e); }
  }

  return res.status(200).json({ ok: true, users: users.length, supernotasRegenerated: generated });
}
