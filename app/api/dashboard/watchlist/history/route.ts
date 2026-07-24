/*
 * Quartly Bot — app/api/dashboard/watchlist/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getHistoricalCloses } from "@/lib/twelvedata";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

const periodToDays: Record<string, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  "3y": 1095,
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const period = searchParams.get("period") || "1m";

  if (!ticker) {
    return NextResponse.json({ ok: false, error: "Missing ticker" }, { status: 400 });
  }

  const days = periodToDays[period] || 30;

  try {
    const prices = await getHistoricalCloses(ticker, days);
    return NextResponse.json({ ok: true, ticker, prices });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to fetch history" }, { status: 500 });
  }
}