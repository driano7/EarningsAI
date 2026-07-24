/*
 * Quartly Bot — app/api/dashboard/calendar/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getEarningsCalendar } from "@/lib/finnhub";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 14);
  const to = future.toISOString().split("T")[0];

  const fromParam = req.nextUrl.searchParams.get("from") || today;
  const toParam = req.nextUrl.searchParams.get("to") || to;

  const calendar = await getEarningsCalendar(fromParam, toParam);

  return NextResponse.json({ ok: true, events: calendar });
}
