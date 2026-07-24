/*
 * Quartly Bot — app/api/dashboard/ai/ticker/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getUserStocks, getUserEtfs } from "@/lib/kv";
import { getQuote, getEarningsHistory, formatEPSBlock, getRecommendationTrends, formatAnalystSignal } from "@/lib/finnhub";
import { getPriceVariations } from "@/lib/price-variations";
import { analyzeTickerWithAI } from "@/lib/ai-analysis";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  const ticker = req.nextUrl.searchParams.get("ticker");

  if (!chatId || !ticker) {
    return NextResponse.json({ ok: false, error: "chatId and ticker required" }, { status: 400 });
  }

  const [stocks, etfs] = await Promise.all([
    getUserStocks(chatId).catch(() => [] as string[]),
    getUserEtfs(chatId).catch(() => [] as string[]),
  ]);
  const userTickers = new Set([...stocks, ...etfs]);
  if (!userTickers.has(ticker)) {
    return NextResponse.json({ ok: false, error: "Ticker not in user watchlist" }, { status: 400 });
  }

  const cacheKey = `ai:ticker:${ticker}`;
  const cached = await kv.get(cacheKey);
  if (cached) return NextResponse.json({ ok: true, analysis: cached });

  const [quote, earnings, signals, variations] = await Promise.all([
    getQuote(ticker),
    getEarningsHistory(ticker),
    getRecommendationTrends(ticker),
    getPriceVariations(ticker),
  ]);

  if (!quote) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const analysis = await analyzeTickerWithAI(ticker, {
    currentPrice: quote.c,
    change1m: variations?.change1m ?? null,
    epsHistory: formatEPSBlock(earnings),
    analystSignal: formatAnalystSignal(signals),
  });

  if (analysis === null) {
    return NextResponse.json({ ok: false, error: "quota_exceeded" });
  }

  await kv.set(cacheKey, analysis, { ex: 3600 });
  return NextResponse.json({ ok: true, analysis });
}
