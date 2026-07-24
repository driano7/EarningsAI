/*
 * Quartly Bot — app/api/dashboard/finance/chart/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getFinanceTransactions } from "@/lib/kv";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const monthsBack = parseInt(searchParams.get("months") || "6", 10);

  const users = await getAllUsers();

  const dailyTotals: Record<string, { income: number; expense: number; invest: number }> = {};
  const categoryTotals: Record<string, number> = {};

  const earliest = new Date();
  earliest.setMonth(earliest.getMonth() - monthsBack);
  const earliestStr = earliest.toISOString().slice(0, 10);

  for (const userId of users) {
    const txns = await getFinanceTransactions(userId);
    for (const t of txns) {
      if (t.date < earliestStr) continue;
      const day = t.date;
      if (!dailyTotals[day]) dailyTotals[day] = { income: 0, expense: 0, invest: 0 };
      if (t.type === "income") dailyTotals[day].income += t.amount;
      else if (t.type === "expense") {
        dailyTotals[day].expense += t.amount;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }
      else if (t.type === "invest") dailyTotals[day].invest += t.amount;
    }
  }

  const daily = Object.entries(dailyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  const categories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, total]) => ({ name, total }));

  return NextResponse.json({ ok: true, daily, categories });
}
