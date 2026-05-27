/*
 * Quartly Bot — app/api/finance/price/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getYahooPriceDataFull } from "@/lib/yahoo";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  const data = await getYahooPriceDataFull(ticker.toUpperCase());
  if (!data) {
    return NextResponse.json({ ok: false, error: "No data" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}
