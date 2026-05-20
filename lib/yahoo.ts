/*
 * Quartly Bot — lib/yahoo.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import yahooFinance from "yahoo-finance2";

export interface YahooPriceData {
  current: number;
  change1d: number | null;
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  change1y: number | null;
  high52w: number | null;
  low52w: number | null;
}

export async function getYahooPriceDataFull(ticker: string): Promise<YahooPriceData | null> {
  try {
    const quote = await yahooFinance.quote(ticker) as Record<string, unknown>;

    let historical: Array<{ close: number }> = [];
    try {
      const period1 = new Date();
      period1.setFullYear(period1.getFullYear() - 1);
      historical = (await yahooFinance.historical(ticker, {
        period1,
        period2: new Date(),
        interval: "1d",
      })) as Array<{ close: number }>;
    } catch {
      historical = [];
    }

    if (!quote || typeof quote.regularMarketPrice !== "number") return null;

    const closes = historical.map((d) => d.close).filter(Boolean);
    const current = quote.regularMarketPrice as number;

    const getChange = (daysAgo: number): number | null => {
      if (closes.length < daysAgo) return null;
      const past = closes[closes.length - daysAgo];
      if (!past || past === 0) return null;
      return ((current - past) / past) * 100;
    };

    return {
      current,
      change1d: typeof quote.regularMarketChangePercent === "number" ? (quote.regularMarketChangePercent as number) : null,
      change1w: getChange(5),
      change1m: getChange(21),
      change3m: getChange(63),
      change1y: getChange(252),
      high52w: typeof quote.fiftyTwoWeekHigh === "number" ? (quote.fiftyTwoWeekHigh as number) : null,
      low52w: typeof quote.fiftyTwoWeekLow === "number" ? (quote.fiftyTwoWeekLow as number) : null,
    };
  } catch {
    return null;
  }
}
