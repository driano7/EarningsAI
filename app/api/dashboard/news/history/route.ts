/*
 * Quartly Bot — app/api/dashboard/news/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSummaryHistory, getSummaryForDate, generateDailyNewsSummary } from "@/lib/news-summary";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const todayEntry = await getSummaryForDate(chatId, today);

  const history = await getSummaryHistory(chatId);

  if (!todayEntry) {
    after(async () => {
      try {
        await generateDailyNewsSummary(chatId);
      } catch (err) {
        console.error(`[history] on-demand supernota regeneration failed:`, err);
      }
    });
  }

  return NextResponse.json({ ok: true, history });
}