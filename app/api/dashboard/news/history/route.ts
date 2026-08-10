/*
 * Quartly Bot — app/api/dashboard/news/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSummaryHistory, getSummaryForDate, generateDailyNewsSummary } from "@/lib/news-summary";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const todayEntry = await getSummaryForDate(chatId, today);

  if (!todayEntry) {
    try {
      await generateDailyNewsSummary(chatId);
    } catch (err) {
      console.error(`[history] on-demand supernota regeneration failed:`, err);
    }
  }

  const history = await getSummaryHistory(chatId);

  return NextResponse.json({ ok: true, history });
}