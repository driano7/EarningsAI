/*
 * Quartly Bot — lib/yahoo.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

// yahoo-finance2 is unreliable in Vercel Serverless (scraping blocked).
// All price variation data now comes from Finnhub candles instead.
// This file is kept for import compatibility but delegates to finnhub.

import { getQuote } from "./finnhub";
import { getPriceVariations } from "./price-variations";

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
    const [quote, variations] = await Promise.all([
      getQuote(ticker),
      getPriceVariations(ticker),
    ]);

    if (!quote) return null;

    return {
      current: quote.c,
      change1d: typeof quote.dp === "number" ? quote.dp : null,
      change1w: variations?.change1w ?? null,
      change1m: variations?.change1m ?? null,
      change3m: variations?.change3m ?? null,
      change1y: variations?.change1y ?? null,
      high52w: variations?.high52w ?? null,
      low52w: variations?.low52w ?? null,
    };
  } catch {
    return null;
  }
}
