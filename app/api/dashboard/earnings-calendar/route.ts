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

    return NextResponse.json({ ok: true, days: results });
  } catch (err) {
    console.error("Earnings calendar fetch error:", err);
    return NextResponse.json({ ok: false, error: "KV error" }, { status: 500 });
  }
}
