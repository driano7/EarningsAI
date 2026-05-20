/*
 * Quartly Bot — api/cron-afternoon.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllUsers, getUserWatchlist, hasReminded, markReminded } from "../lib/kv";
import { getEarningsCalendar, getQuote, getRecommendationTrends, formatAnalystSignal } from "../lib/finnhub";
import { getLogoUrl } from "../lib/logo";
import { sendMessageWithLogo } from "../lib/telegram";
import { formatPriceBlock, PriceData } from "../lib/price";
import { SP500 } from "../lib/sp500";
import { ETFS } from "../lib/etfs";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const users = await getAllUsers();
  if (users.length === 0) {
    return res.status(200).json({ ok: true, message: "No users" });
  }

  const today = new Date().toISOString().split("T")[0];
  const calendar = await getEarningsCalendar(today, today);
  const amcEvents = calendar.filter((e) => (e.hour || "").toUpperCase() === "AMC");

  for (const chatId of users) {
    const { stocks, etfs } = await getUserWatchlist(chatId);
    const allTickers = [...stocks, ...etfs];

    for (const event of amcEvents) {
      if (!allTickers.includes(event.symbol)) continue;

      const reminded = await hasReminded(chatId, event.symbol, today, "2h");
      if (reminded) continue;

      const isEtf = etfs.includes(event.symbol);
      const [quote, recs] = await Promise.all([getQuote(event.symbol), getRecommendationTrends(event.symbol)]);
      const signal = formatAnalystSignal(recs);
      const spCompany = SP500.find((c) => c.ticker === event.symbol);
      const etfObj = ETFS.find((e) => e.ticker === event.symbol);
      const name = spCompany?.name || etfObj?.name || event.name || event.symbol;
      const sector = spCompany?.sector || etfObj?.category || "";
      const logoUrl = await getLogoUrl(event.symbol, isEtf);

      let priceText = "";
      if (quote) {
        const priceData: PriceData = {
          current: quote.c,
          change1d: quote.dp,
          change1w: null,
          change1m: null,
          change3m: null,
          change1y: null,
          high52w: quote.h,
          low52w: quote.l,
        };
        priceText = formatPriceBlock(event.symbol, name, sector, priceData);
      }

      const msg = `⏰ *Reporta en ~2 horas (AMC)*
*${event.symbol}* — ${name}
📊 EPS Est: $${event.estimate.toFixed(2)}
${event.revenueEstimate ? `💰 Revenue Est: $${(event.revenueEstimate / 1e9).toFixed(2)}B` : ""}
${priceText}
${signal}`;

      await sendMessageWithLogo(chatId, msg, logoUrl);
      await markReminded(chatId, event.symbol, today, "2h");
    }
  }

  return res.status(200).json({ ok: true });
}
