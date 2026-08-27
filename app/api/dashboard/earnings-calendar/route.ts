/*
 * Quartly Bot — app/api/dashboard/earnings-calendar/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

interface StoredEarningsDay {
  date: string;
  tickers: Array<{
    ticker: string;
    name: string;
    logo: string | null;
    estimate: number;
    hour?: string;
  }>;
  fetchedAt: number;
}

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  const year = req.nextUrl.searchParams.get("year");

  if (!month || !year) {
    return NextResponse.json({ ok: false, error: "Missing month/year" }, { status: 400 });
  }

  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const results: StoredEarningsDay[] = [];

  const keys: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    keys.push(`earnings:day:${dateStr}`);
  }

  try {
    const values = await Promise.all(
      keys.map(async (key) => {
        const data = await kv.get<StoredEarningsDay>(key);
        return data;
      })
    );

    for (const val of values) {
      if (val && val.tickers.length > 0) {
        results.push(val);
      }
    }

    // Fallback: si KV vacío (ej. cron no corrió o NVDA 26-ago no guardado), fetch directo Finnhub para el mes solicitado
    if (results.length === 0) {
      try {
        const { getEarningsCalendar } = await import("@/lib/finnhub");
        const from = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const cal = await getEarningsCalendar(from, to);
        const byDate = new Map<string, StoredEarningsDay>();
        for (const ev of cal) {
          if (!ev.date) continue;
          if (!byDate.has(ev.date)) byDate.set(ev.date, { date: ev.date, tickers: [], fetchedAt: Date.now() });
          const day = byDate.get(ev.date)!;
          if (!day.tickers.some(t=>t.ticker===ev.symbol)) {
            const sp = (await import("@/lib/sp500")).SP500.find(c=>c.ticker===ev.symbol);
            day.tickers.push({ ticker: ev.symbol, name: ev.name || sp?.name || ev.symbol, logo: sp ? `https://logo.clearbit.com/${sp.name.toLowerCase().replace(/[^a-z0-9]/g,"")}.com` : null, estimate: ev.estimate, hour: ev.hour });
          }
        }
        results.push(...byDate.values());
      } catch (e) { console.error("fallback finnhub error", e); }
    }

    return NextResponse.json({ ok: true, days: results });
  } catch (err) {
    console.error("Earnings calendar fetch error:", err);
    return NextResponse.json({ ok: false, error: "KV error" }, { status: 500 });
  }
}
