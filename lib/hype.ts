/*
 * Quartly Bot — lib/hype.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { getEarningsCalendar, getEarningsHistory, getRecommendationTrends, getQuote } from "./finnhub";
import type { CompanyHype, HypeRanking } from "./openrouter";

export async function buildHypeRanking(): Promise<HypeRanking | null> {
  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const future = new Date(today);
  future.setDate(future.getDate() + 7);
  const to = future.toISOString().split("T")[0];

  const calendar = await getEarningsCalendar(from, to);
  if (calendar.length === 0) return null;

  const hypeData: CompanyHype[] = [];

  for (const event of calendar.slice(0, 50)) {
    const symbol = event.symbol;
    const [history, recs, quote] = await Promise.all([
      getEarningsHistory(symbol),
      getRecommendationTrends(symbol),
      getQuote(symbol),
    ]);

    const surprises = history.slice(0, 4).map((h) => h.surprisePercent ?? 0);
    const avgSurprise = surprises.length > 0 ? surprises.reduce((a, b) => a + b, 0) / surprises.length : 0;

    const latestRec = recs[0];
    const totalRecs = latestRec
      ? latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongBuy + latestRec.strongSell
      : 1;
    const buys = latestRec ? latestRec.buy + latestRec.strongBuy : 0;
    const buyRatio = totalRecs > 0 ? buys / totalRecs : 0.5;

    const priceChange1m = quote && quote.pc ? ((quote.c - quote.pc) / quote.pc) * 100 : 0;

    const hypeScore = avgSurprise * 0.5 + buyRatio * 100 * 0.3 + priceChange1m * 0.2;

    hypeData.push({
      ticker: symbol,
      name: event.name || symbol,
      date: event.date,
      hypeScore,
      avgSurprise,
      buyRatio,
      priceChange1m,
    });
  }

  hypeData.sort((a, b) => b.hypeScore - a.hypeScore);

  return {
    top5: hypeData.slice(0, 5),
    bottom5: hypeData.slice(-5).reverse(),
  };
}
