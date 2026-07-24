/*
 * Quartly Bot — app/api/dashboard/watchlist/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getHistoricalCloses } from "@/lib/twelvedata";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

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

  try {
    const prices = await getHistoricalCloses(ticker, period);
    return NextResponse.json({ ok: true, ticker, prices });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to fetch history" }, { status: 500 });
  }
}