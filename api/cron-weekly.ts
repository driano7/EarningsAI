/*
 * Quartly Bot — api/cron-weekly.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Cron semanal (sábado 7pm CST → domingo 01:00 UTC).
 * Envía un reporte completo de cada ticker en la watchlist de cada usuario,
 * con análisis opcional de IA (1 batch por usuario si hay quota).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllUsers, getUserWatchlist } from "../lib/kv";
import { getEarningsCalendar } from "../lib/finnhub";
import { buildTickerCard } from "../lib/build-ticker-card";
import { sendMessage, sendMessageWithLogo } from "../lib/telegram";
import { checkAndConsumeQuota, getRemainingQuota } from "../lib/quota";
import { SP500 } from "../lib/sp500";
import { ETFS } from "../lib/etfs";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

async function finnhubRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const is429 =
        (err instanceof Error && err.message.includes("429")) ||
        (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 429);
      if (is429 && attempt < maxAttempts) {
        console.warn(`[cron-weekly] 429 en ${label}, intento ${attempt}/${maxAttempts}, backoff 2s...`);
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`[cron-weekly] Fallo tras ${maxAttempts} intentos en ${label}`);
}

function resolveName(ticker: string): string {
  const sp = SP500.find((c) => c.ticker === ticker);
  if (sp) return sp.name;
  const etf = ETFS.find((e) => e.ticker === ticker);
  if (etf) return etf.name;
  return ticker;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const users = await getAllUsers();
  if (users.length === 0) {
    return res.status(200).json({ ok: true, message: "No hay usuarios registrados" });
  }

  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 90);
  const upcomingCalendar = await finnhubRetry(
    () => getEarningsCalendar(today, future.toISOString().split("T")[0]),
    "getEarningsCalendar"
  );

  let totalUsersProcessed = 0;
  let totalTickersSent = 0;

  for (const chatId of users) {
    const { stocks, etfs } = await getUserWatchlist(chatId);
    const allTickers = [...stocks, ...etfs];
    if (allTickers.length === 0) continue;

    const userTickerNames: Record<string, string> = {};
    for (const t of allTickers) {
      userTickerNames[t] = resolveName(t);
    }

    await sendMessage(chatId, `📬 *Reporte Semanal Quartly* — *${allTickers.length} activos* en tu watchlist\nGenerando...`);

    for (const ticker of allTickers) {
      const isEtf = etfs.includes(ticker);

      try {
        const { msg, logoUrl } = await finnhubRetry(
          () => buildTickerCard(ticker, isEtf, upcomingCalendar),
          `buildTickerCard(${ticker})`
        );
        await sendMessageWithLogo(chatId, msg, logoUrl);
        totalTickersSent++;
      } catch (err) {
        console.error(`[cron-weekly] Error con ${ticker} para ${chatId}:`, err);
        await sendMessage(chatId, `⚠️ No se pudo cargar la ficha de *${ticker}*.`);
      }

      await sleep(800);
    }

    // ── OpenRouter: 1 batch request por usuario si hay quota ──────────
    const quota = await checkAndConsumeQuota(1);
    if (quota.allowed && allTickers.length > 0) {
      try {
        const portfolioLines = allTickers.map((t) => `• ${t} — ${userTickerNames[t]}${etfs.includes(t) ? " (ETF)" : ""}`);
        const prompt = `Eres Quartly, un asistente de inversiones para hispanohablantes.
A continuación está la watchlist semanal de un usuario. Escribe un breve análisis de portafolio (máx 250 palabras, texto plano, sin markdown) que:

1. Destaque la diversificación del portafolio (sectores, tipos de activo)
2. Mencione si hay concentración en algún sector
3. Dé 1-2 recomendaciones generales para la próxima semana
4. Termine con un veredicto: VEREDICTO: [👍/⚠️/🔴]

Watchlist del usuario:
${portfolioLines.join("\n")}`;

        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://quartly.vercel.app",
            "X-Title": "Quartly Bot",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-maverick:free",
            temperature: 0.3,
            max_tokens: 600,
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: `Analiza mi portafolio de ${allTickers.length} activos.` },
            ],
          }),
        });

        if (orRes.ok) {
          const json = (await orRes.json()) as Record<string, unknown>;
          const choices = (json.choices as Array<{ message: { content: string } }>) || [];
          const analysis = choices[0]?.message?.content || "";
          if (analysis) {
            await sendMessage(chatId, `🤖 *Análisis semanal de tu portafolio*\n\n${analysis}`);
          }
        }
      } catch (err) {
        console.error(`[cron-weekly] OpenRouter error para ${chatId}:`, err);
      }
    }

    const remaining = await getRemainingQuota();
    const quotaNote = remaining <= 0 ? "\n⚠️ Sin análisis IA — límite diario alcanzado." : "";

    await sendMessage(
      chatId,
      `📊 *Reporte semanal completado* — ${allTickers.length} activos analizados.${quotaNote}\n\n📅 Próximo reporte: sábado.`
    );

    totalUsersProcessed++;
    await sleep(2000);
  }

  return res.status(200).json({
    ok: true,
    message: `Reporte semanal enviado a ${totalUsersProcessed} usuarios, ${totalTickersSent} tickers procesados`,
  });
}
