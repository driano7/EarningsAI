/*
 * Quartly Bot — app/api/dashboard/watchlist/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getUserWatchlist, removeStock, removeEtf } from "@/lib/kv";
import { SP500 } from "@/lib/sp500";
import { ETFS } from "@/lib/etfs";
import { CUSTOM_TICKERS } from "@/lib/custom-tickers";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const users = await getAllUsers();
  const tickerCount: Record<string, { stocks: number; etfs: number }> = {};

  for (const chatId of users) {
    const { stocks, etfs } = await getUserWatchlist(chatId);
    for (const t of stocks) {
      if (!tickerCount[t]) tickerCount[t] = { stocks: 0, etfs: 0 };
      tickerCount[t].stocks++;
    }
    for (const t of etfs) {
      if (!tickerCount[t]) tickerCount[t] = { stocks: 0, etfs: 0 };
      tickerCount[t].etfs++;
    }
  }

  const tickerInfo = (ticker: string) => {
    const sp = SP500.find((c) => c.ticker === ticker);
    if (sp) return { name: sp.name, sector: sp.sector, type: "stock" as const };
    const etf = ETFS.find((e) => e.ticker === ticker);
    if (etf) return { name: etf.name, sector: etf.category, type: "etf" as const };
    const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
    if (custom) return { name: custom.name, sector: custom.sector, type: "custom" as const };
    return { name: ticker, sector: "", type: "unknown" as const };
  };

  const tickers = Object.entries(tickerCount)
    .map(([ticker, counts]) => ({
      ticker,
      ...tickerInfo(ticker),
      users: counts.stocks + counts.etfs,
    }))
    .sort((a, b) => b.users - a.users);

  return NextResponse.json({ ok: true, tickers });
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { chatId, ticker, type } = await req.json();
  if (!chatId || !ticker) {
    return NextResponse.json({ ok: false, error: "chatId and ticker required" }, { status: 400 });
  }

  if (type === "etf") {
    await removeEtf(chatId, ticker);
  } else {
    await removeStock(chatId, ticker);
  }

  return NextResponse.json({ ok: true });
}
