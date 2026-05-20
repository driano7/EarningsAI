/*
 * Quartly Bot — api/cron-evening.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllUsers, getUserWatchlist } from "../lib/kv";
import { getEarningsCalendar, getEarningsHistory, getRecommendationTrends, getQuote, formatEPSBlock, formatAnalystSignal } from "../lib/finnhub";
import { getLogoUrl } from "../lib/logo";
import { sendMessageWithLogo, sendMessage } from "../lib/telegram";
import { SP500 } from "../lib/sp500";
import { ETFS } from "../lib/etfs";
import { checkAndConsumeQuota, getQuotaExceededMessage } from "../lib/quota";
import { generateBatchReport, CompanyData } from "../lib/openrouter";
import { buildHypeRanking } from "../lib/hype";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const today = new Date().toISOString().split("T")[0];
  const calendar = await getEarningsCalendar(today, today);
  const reported = calendar.filter((e) => e.actual !== null && e.actual !== undefined);

  if (reported.length === 0) {
    return res.status(200).json({ ok: true, message: "No earnings reported today" });
  }

  const users = await getAllUsers();
  if (users.length === 0) {
    return res.status(200).json({ ok: true, message: "No users" });
  }

  const userFavs: Record<string, string[]> = {};
  for (const chatId of users) {
    const { stocks, etfs } = await getUserWatchlist(chatId);
    const allTickers = [...stocks, ...etfs];
    const favs = reported.filter((e) => allTickers.includes(e.symbol)).map((e) => e.symbol);
    if (favs.length > 0) {
      userFavs[chatId] = favs;
    }
  }

  const allFavTickers = [...new Set(Object.values(userFavs).flat())];
  if (allFavTickers.length === 0) {
    return res.status(200).json({ ok: true, message: "No user favorites reported today" });
  }

  const hypeRanking = await buildHypeRanking();

  const companyDataMap: Record<string, CompanyData> = {};
  for (const event of reported) {
    if (!allFavTickers.includes(event.symbol)) continue;

    const spCompany = SP500.find((c) => c.ticker === event.symbol);
    const etfObj = ETFS.find((e) => e.ticker === event.symbol);
    const name = spCompany?.name || etfObj?.name || event.name || event.symbol;
    const sector = spCompany?.sector || etfObj?.category || "";

    const [history, recs, quote] = await Promise.all([
      getEarningsHistory(event.symbol),
      getRecommendationTrends(event.symbol),
      getQuote(event.symbol),
    ]);

    companyDataMap[event.symbol] = {
      ticker: event.symbol,
      name,
      sector,
      date: event.date,
      hour: event.hour || "N/A",
      epsEstimate: event.estimate,
      epsActual: event.actual ?? null,
      revenueEstimate: event.revenueEstimate ?? null,
      surprisePercent: event.surprisePercent ?? null,
      price: quote ? quote.c : null,
      analystSignal: formatAnalystSignal(recs),
      epsHistory: formatEPSBlock(history),
    };
  }

  const favReports = Object.values(companyDataMap);

  const quota = await checkAndConsumeQuota(1);

  if (!quota.allowed) {
    for (const [chatId, favs] of Object.entries(userFavs)) {
      for (const ticker of favs) {
        const data = companyDataMap[ticker];
        if (!data) continue;
        const logoUrl = await getLogoUrl(ticker, false);
        const rawMsg = `📊 *${data.ticker}* — ${data.name}
Fecha: ${data.date} (${data.hour})
EPS Est: $${data.epsEstimate.toFixed(2)} | EPS Real: ${data.epsActual !== null ? "$" + data.epsActual.toFixed(2) : "N/A"}
${data.revenueEstimate ? `Revenue Est: $${(data.revenueEstimate / 1e9).toFixed(2)}B` : ""}
Surprise: ${data.surprisePercent !== null ? (data.surprisePercent >= 0 ? "+" : "") + data.surprisePercent.toFixed(1) + "%" : "N/A"}
${data.price !== null ? "Precio: $" + data.price.toFixed(2) : "Precio: N/A"}
${data.analystSignal}
${data.epsHistory}
⚠️ Análisis con IA no disponible hoy. Límite alcanzado.`;
        await sendMessageWithLogo(chatId, rawMsg, logoUrl);
      }
      await sendMessage(chatId, getQuotaExceededMessage());
    }
    return res.status(200).json({ ok: true });
  }

  const report = await generateBatchReport({ favReports, hypeRanking });

  for (const [chatId, favs] of Object.entries(userFavs)) {
    for (const ticker of favs) {
      const analysis = report.favReports[ticker];
      if (!analysis) continue;
      const logoUrl = await getLogoUrl(ticker, false);
      await sendMessageWithLogo(chatId, analysis, logoUrl);
    }

    if (report.hypeMessage) {
      await sendMessage(chatId, report.hypeMessage);
    }
  }

  return res.status(200).json({ ok: true });
}
