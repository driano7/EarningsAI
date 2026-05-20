/*
 * Quartly Bot — lib/price-variations.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

// Fetches 1 year of daily candles from Finnhub to compute
// 1w, 1m, 3m, 1y price variations and 52-week high/low.

const BASE = "https://finnhub.io/api/v1";
const TOKEN = process.env.FINNHUB_API_KEY || "";

export interface PriceVariations {
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  change1y: number | null;
  high52w: number | null;
  low52w: number | null;
}

export async function getPriceVariations(ticker: string): Promise<PriceVariations | null> {
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 370 * 24 * 60 * 60; // ~1 year + buffer

    const url = `${BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    if (!data || data.s !== "ok" || !Array.isArray(data.c) || (data.c as number[]).length === 0) return null;

    const closes = data.c as number[];
    const highs = data.h as number[];
    const lows = data.l as number[];
    const n = closes.length;
    const current = closes[n - 1];

    const calcChange = (daysBack: number): number | null => {
      if (n < daysBack + 1) return null;
      const past = closes[n - 1 - daysBack];
      if (!past || past === 0) return null;
      return ((current - past) / past) * 100;
    };

    const high52w = highs.length > 0 ? Math.max(...highs) : null;
    const low52w = lows.length > 0 ? Math.min(...lows) : null;

    return {
      change1w: calcChange(5),
      change1m: calcChange(21),
      change3m: calcChange(63),
      change1y: calcChange(252),
      high52w,
      low52w,
    };
  } catch {
    return null;
  }
}
