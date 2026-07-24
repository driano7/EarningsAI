/*
 * Quartly Bot — app/api/dashboard/users/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getUserWatchlist } from "@/lib/kv";
import { kv } from "@vercel/kv";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userIds = await getAllUsers();
  const users = [];

  for (const chatId of userIds) {
    const { stocks, etfs } = await getUserWatchlist(chatId);
    users.push({
      chatId,
      stocks: stocks.length,
      etfs: etfs.length,
      totalWatchlist: stocks.length + etfs.length,
      tickers: [...stocks, ...etfs],
    });
  }

  users.sort((a, b) => b.totalWatchlist - a.totalWatchlist);

  return NextResponse.json({ ok: true, users });
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await req.json();
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  await kv.srem("users", chatId);
  await kv.del(`stocks:${chatId}`);
  await kv.del(`etfs:${chatId}`);

  return NextResponse.json({ ok: true });
}
