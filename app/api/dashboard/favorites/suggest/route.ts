/*
 * Quartly Bot — app/api/dashboard/favorites/suggest/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { SP500 } from "@/lib/sp500";
import { ETFS } from "@/lib/etfs";
import { CUSTOM_TICKERS } from "@/lib/custom-tickers";
import { CRYPTO_ID_MAP } from "@/lib/coingecko";

export interface Suggestion {
  ticker: string;
  name: string;
  type: "stock" | "etf" | "crypto";
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toUpperCase();
  if (!q) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  const cryptoEntries: Suggestion[] = Object.entries(CRYPTO_ID_MAP).map(([ticker, id]) => ({
    ticker,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    type: "crypto" as const,
  }));

  const stockEntries: Suggestion[] = [
    ...SP500.map((c) => ({ ticker: c.ticker, name: c.name, type: "stock" as const })),
    ...CUSTOM_TICKERS.filter((t) => !t.isEtf).map((t) => ({ ticker: t.ticker, name: t.name, type: "stock" as const })),
  ];

  const etfEntries: Suggestion[] = [
    ...ETFS.map((e) => ({ ticker: e.ticker, name: e.name, type: "etf" as const })),
    ...CUSTOM_TICKERS.filter((t) => t.isEtf).map((t) => ({ ticker: t.ticker, name: t.name, type: "etf" as const })),
  ];

  const all = [...stockEntries, ...etfEntries, ...cryptoEntries];

  const filtered = all
    .filter(
      (s) =>
        s.ticker.toUpperCase().startsWith(q) ||
        s.name.toUpperCase().includes(q) ||
        s.ticker.toUpperCase().includes(q)
    )
    .slice(0, 12);

  return NextResponse.json({ ok: true, suggestions: filtered });
}