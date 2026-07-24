/*
 * Quartly Bot — app/api/dashboard/stats/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getUserWatchlist } from "@/lib/kv";
import { getEarningsCalendar } from "@/lib/finnhub";
import { getRemainingQuota } from "@/lib/quota";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const users = await getAllUsers();
  let totalStocks = 0;
  let totalEtfs = 0;

  for (const chatId of users) {
    const { stocks, etfs } = await getUserWatchlist(chatId);
    totalStocks += stocks.length;
    totalEtfs += etfs.length;
  }

  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const calendar = await getEarningsCalendar(today, future.toISOString().split("T")[0]);

  const quotaRemaining = await getRemainingQuota();

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers: users.length,
      totalStocks,
      totalEtfs,
      totalWatchlist: totalStocks + totalEtfs,
      upcomingEarnings: calendar.length,
      quotaRemaining,
      quotaTotal: 25,
    },
  });
}
