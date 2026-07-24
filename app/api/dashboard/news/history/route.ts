/*
 * Quartly Bot — app/api/dashboard/news/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSummaryHistory } from "@/lib/news-summary";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const history = await getSummaryHistory(chatId);

  return NextResponse.json({ ok: true, history });
}
