/*
 * Quartly Bot — lib/price-variations.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCandles(ticker: string, attempt = 0): Promise<Record<string, unknown> | null> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 370 * 24 * 60 * 60;
  const url = `${BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${TOKEN}`;

  const res = await fetch(url);

  if (res.status === 429) {
    if (attempt >= 2) return null; // max 3 attempts
    await sleep(1500 * (attempt + 1)); // 1.5s, 3s
    return fetchCandles(ticker, attempt + 1);
  }

  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getPriceVariations(ticker: string): Promise<PriceVariations | null> {
  try {
    const data = await fetchCandles(ticker);
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

    return {
      change1w: calcChange(5),
      change1m: calcChange(21),
      change3m: calcChange(63),
      change1y: calcChange(252),
      high52w: highs.length > 0 ? Math.max(...highs) : null,
      low52w: lows.length > 0 ? Math.min(...lows) : null,
    };
  } catch {
    return null;
  }
}
