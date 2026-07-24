/*
 * Quartly Bot — app/api/dashboard/favorites/quote/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { isTwelveDataEnabled, getHistoricalCloses } from "@/lib/twelvedata";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  const cacheKey = `quote:history:${ticker}`;
  const cached = await kv.get<Array<{ date: string; value: number }>>(cacheKey);
  if (cached && cached.length > 0) {
    return NextResponse.json({ ok: true, data: cached });
  }

  if (isTwelveDataEnabled()) {
    try {
      const data = await getHistoricalCloses(ticker, 365);
      if (data.length > 0) {
        await kv.set(cacheKey, data, { ex: 86400 });
        return NextResponse.json({ ok: true, data });
      }
    } catch (err) {
      console.error(`[TwelveData] Error for ${ticker}:`, err);
    }
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json(
      { ok: false, error: "No hay API key de Twelve Data ni Finnhub configurada." },
      { status: 503 }
    );
  }

  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 365 * 24 * 60 * 60;
    const url = `${FINNHUB_BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
    const res = await fetch(url);

    if (res.status === 403) {
      return NextResponse.json(
        { ok: false, error: "Finnhub plan gratuito no incluye datos historicos. Intenta de nuevo mas tarde." },
        { status: 503 }
      );
    }

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Finnhub API error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    if (data.s !== "ok" || !data.c || !data.t) {
      return NextResponse.json({ ok: false, error: "No data available" }, { status: 404 });
    }

    const result = data.t.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000).toISOString().split("T")[0],
      value: data.c[i],
    }));

    await kv.set(cacheKey, result, { ex: 86400 });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
