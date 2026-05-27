/*
 * Quartly Bot — app/api/finance/recommendation/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecommendationTrends } from "@/lib/finnhub";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  const recs = await getRecommendationTrends(ticker.toUpperCase());
  if (recs.length === 0) {
    return NextResponse.json({ ok: false, error: "No data" }, { status: 404 });
  }

  const latest = recs[0];
  return NextResponse.json({
    ok: true,
    data: {
      strongBuy: latest.strongBuy,
      buy: latest.buy,
      hold: latest.hold,
      sell: latest.sell,
      strongSell: latest.strongSell,
    },
  });
}
