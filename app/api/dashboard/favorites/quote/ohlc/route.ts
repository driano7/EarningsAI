/*
 * Quartly Bot — app/api/dashboard/favorites/quote/ohlc/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getTimeSeries } from "@/lib/twelvedata";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";
const periodToDays: Record<string, number> = { "1d": 1, "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "3y": 1095 };

async function fetchFinnhubOHLC(ticker: string, days: number) {
  if (!FINNHUB_KEY) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.s !== "ok" || !data.c) return null;
  return data.t.map((ts: number, i: number) => ({
    date: new Date(ts * 1000).toISOString().split("T")[0],
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
  }));
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const period = req.nextUrl.searchParams.get("period") || "1y";
  if (!ticker) return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  const days = periodToDays[period] || 365;
  const cacheKey = `quote:ohlc:${ticker}:${period}`;
  const cached = await kv.get(cacheKey);
  if (cached) return NextResponse.json({ ok: true, data: cached });

  // Try TwelveData first (has OHLC)
  try {
    const candles = await getTimeSeries(ticker, "1day", Math.min(days, 5000));
    if (candles && candles.length > 0) {
      const ohlc = candles.reverse().map(c => ({ date: c.date, open: c.open, high: c.high, low: c.low, close: c.close }));
      await kv.set(cacheKey, ohlc, { ex: 3600 });
      return NextResponse.json({ ok: true, data: ohlc });
    }
  } catch {}

  const finnhub = await fetchFinnhubOHLC(ticker, days);
  if (finnhub && finnhub.length > 0) {
    await kv.set(cacheKey, finnhub, { ex: 3600 });
    return NextResponse.json({ ok: true, data: finnhub });
  }

  return NextResponse.json({ ok: false, error: "No OHLC data" }, { status: 404 });
}
