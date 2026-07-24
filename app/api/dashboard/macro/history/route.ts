/*
 * Quartly Bot — app/api/dashboard/macro/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { checkAndConsumeRateLimit } from "@/lib/api-ratelimit";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const FRED_KEY = process.env.FRED || "";
const FRED_DAILY_LIMIT = 50;
const FRED_RATE_KEY = "ratelimit:fred";

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get("seriesId");
  if (!seriesId) {
    return NextResponse.json({ ok: false, error: "seriesId required" }, { status: 400 });
  }

  const cacheKey = `fred:history:${seriesId}`;
  const cached = await kv.get<Array<{ date: string; value: number }>>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, data: cached });
  }

  const { allowed } = await checkAndConsumeRateLimit(FRED_RATE_KEY, FRED_DAILY_LIMIT);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=asc&observation_start=${from}`;
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `FRED API error: ${res.status}` }, { status: 500 });
    }

    const data = (await res.json()) as { observations?: Array<{ value: string; date: string }> };
    const observations = data.observations || [];

    const result = observations
      .filter((obs) => obs.value !== ".")
      .map((obs) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }));

    await kv.set(cacheKey, result, { ex: 86400 });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
