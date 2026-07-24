/*
 * Quartly Bot — app/api/dashboard/favorites/earnings/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserStocks, getUserEtfs, getUserCryptos, getCachedTickerData, setCachedTickerData } from "@/lib/kv";
import type { CachedTickerEarnings } from "@/lib/kv";
import { getEarningsHistory, getRecommendationTrends, getQuote, getCandles, getEarningsCalendar } from "@/lib/finnhub";
import type { EarningEvent, RecommendationTrend, QuoteData, CalendarEarning } from "@/lib/finnhub";
import { getLogoUrl } from "@/lib/logo";
import { getCMCQuote, isCMCEnabled } from "@/lib/coinmarketcap";
import { isTwelveDataEnabled, getSparkline } from "@/lib/twelvedata";

interface StockDetail {
  ticker: string;
  logo: string | null;
  earnings: EarningEvent[];
  analystSignals: RecommendationTrend[];
  quote: QuoteData | null;
  sparkline: number[];
  nextEarnings: CalendarEarning | null;
}

interface EtfDetail {
  ticker: string;
  logo: string | null;
  quote: QuoteData | null;
  sparkline: number[];
}

interface CryptoDetail {
  ticker: string;
  logo: string | null;
  priceUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCapUsd: number | null;
  sparkline: number[];
}

/* Run fn for each item sequentially with a delay between calls */
async function sequential<T, R>(items: T[], delay: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delay));
    results.push(await fn(items[i], i));
  }
  return results;
}

async function fetchStockDetail(ticker: string): Promise<StockDetail> {
  const cached = await getCachedTickerData(ticker);
  if (cached && cached.sparkline && cached.sparkline.length > 1) {
    return {
      ticker,
      logo: cached.logo,
      earnings: cached.earnings as EarningEvent[],
      analystSignals: cached.analystSignals as RecommendationTrend[],
      quote: cached.quote as QuoteData | null,
      sparkline: cached.sparkline,
      nextEarnings: null,
    };
  }

  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const futureDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const to = futureDate.toISOString().split("T")[0];

  let sparkline: number[] = [];

  if (isTwelveDataEnabled()) {
    sparkline = await getSparkline(ticker, 30);
  }

  const [earnings, signals, quote, logo, candles, calendar] = await Promise.all([
    getEarningsHistory(ticker),
    getRecommendationTrends(ticker),
    getQuote(ticker),
    getLogoUrl(ticker, false),
    sparkline.length === 0 ? getCandles(ticker) : Promise.resolve(null),
    getEarningsCalendar(from, to, ticker),
  ]);

  if (sparkline.length === 0 && candles?.closes) {
    sparkline = candles.closes.slice(-30);
  }
  const nextEarnings = calendar.length > 0 ? calendar[0] : null;
  const detail: StockDetail = { ticker, logo, earnings, analystSignals: signals, quote, sparkline, nextEarnings };
  if (sparkline.length > 1) {
    await setCachedTickerData(ticker, {
      logo,
      earnings: earnings as CachedTickerEarnings["earnings"],
      analystSignals: signals as CachedTickerEarnings["analystSignals"],
      quote: quote as CachedTickerEarnings["quote"],
      sparkline,
    });
  }
  return detail;
}

async function fetchEtfDetail(ticker: string): Promise<EtfDetail> {
  const cached = await getCachedTickerData(ticker);
  if (cached && cached.sparkline && cached.sparkline.length > 1) {
    return {
      ticker,
      logo: cached.logo,
      quote: cached.quote as QuoteData | null,
      sparkline: cached.sparkline,
    };
  }
  const [quote, logo, candles] = await Promise.all([
    getQuote(ticker),
    getLogoUrl(ticker, true),
    getCandles(ticker),
  ]);
  const sparkline = candles?.closes?.slice(-30) || [];
  const detail: EtfDetail = { ticker, logo, quote, sparkline };
  if (sparkline.length > 1) {
    await setCachedTickerData(ticker, {
      logo,
      earnings: [] as CachedTickerEarnings["earnings"],
      analystSignals: [] as CachedTickerEarnings["analystSignals"],
      quote: quote as CachedTickerEarnings["quote"],
      sparkline,
    });
  }
  return detail;
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  try {
    const [stockTickers, etfTickers, cryptoTickers] = await Promise.all([
      getUserStocks(chatId).catch(() => [] as string[]),
      getUserEtfs(chatId).catch(() => [] as string[]),
      getUserCryptos(chatId).catch(() => [] as string[]),
    ]);

    const [stocks, etfs, cryptos] = await Promise.all([
      sequential(stockTickers, 350, async (ticker) => {
        try { return await fetchStockDetail(ticker); }
        catch { return null; }
      }),
      sequential(etfTickers, 350, async (ticker) => {
        try { return await fetchEtfDetail(ticker); }
        catch { return null; }
      }),
      sequential(cryptoTickers, 200, async (ticker) => {
        try {
          const cmcQuote = isCMCEnabled() ? await getCMCQuote(ticker) : null;
          const logo = cmcQuote ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcQuote.id}.png` : null;
          return {
            ticker,
            logo,
            priceUsd: cmcQuote?.price ?? null,
            change24h: cmcQuote?.change24h ?? null,
            change7d: cmcQuote?.change7d ?? null,
            marketCapUsd: cmcQuote?.marketCap ?? null,
            sparkline: [],
          } satisfies CryptoDetail;
        } catch { return null; }
      }),
    ]);

    const filteredStocks = stocks.filter(Boolean) as StockDetail[];
    const filteredEtfs = etfs.filter(Boolean) as EtfDetail[];
    const filteredCryptos = cryptos.filter(Boolean) as CryptoDetail[];

    return NextResponse.json({ ok: true, stocks: filteredStocks, etfs: filteredEtfs, cryptos: filteredCryptos });
  } catch (err) {
    console.error("[favorites/details API] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
