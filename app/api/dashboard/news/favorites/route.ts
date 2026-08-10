/*
 * Quartly Bot — app/api/dashboard/news/favorites/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFavoritesNewsBundle } from "@/lib/favorites-news";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  try {
    const bundle = await getFavoritesNewsBundle(chatId, refresh ? { byPassCache: true } : undefined);
    return NextResponse.json({ ok: true, ...bundle });
  } catch (err) {
    console.error("[news/favorites] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to load favorites news" }, { status: 500 });
  }
}