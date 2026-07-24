/*
 * Quartly Bot — app/api/dashboard/favorites/quote/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getHistoricalCloses } from "@/lib/twelvedata";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";
const TWELVE_KEY = process.env.TWELVE || "";

const periodToDays: Record<string, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  "3y": 1095,
};

async function fetchFinnhubHistory(ticker: string, days: number): Promise<Array<{ date: string; value: number }> | null> {
  if (!FINNHUB_KEY) return null;

  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.s !== "ok" || !data.c || !data.t) return null;

    return data.t.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000).toISOString().split("T")[0],
      value: data.c[i],
    }));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const period = req.nextUrl.searchParams.get("period") || "1y";

  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  const days = periodToDays[period] || 365;
  const cacheKey = `quote:history:${ticker}:${period}`;

  try {
    const cached = await kv.get<Array<{ date: string; value: number }>>(cacheKey);
    if (cached && cached.length > 0) {
      return NextResponse.json({ ok: true, data: cached });
    }

    // Try Twelve Data first (better for historical data)
    if (TWELVE_KEY) {
      const twelveData = await getHistoricalCloses(ticker, days);
      if (twelveData && twelveData.length > 0) {
        await kv.set(cacheKey, twelveData, { ex: 86400 });
        return NextResponse.json({ ok: true, data: twelveData });
      }
    }

    // Fallback to Finnhub
    const finnhubData = await fetchFinnhubHistory(ticker, days);
    if (finnhubData && finnhubData.length > 0) {
      await kv.set(cacheKey, finnhubData, { ex: 86400 });
      return NextResponse.json({ ok: true, data: finnhubData });
    }

    return NextResponse.json({ ok: false, error: "No data available" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}