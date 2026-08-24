/*
 * Quartly Bot — app/api/finance/price/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getYahooPriceDataFull } from "@/lib/yahoo";
import { getCryptoQuote } from "@/lib/coingecko";

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "ADA", "DOT", "AVAX", "MATIC", "LINK", "UNI", "ATOM", "XRP", "BNB", "DOGE", "LTC", "TRX", "NEAR", "APT", "ARB", "OP", "SUI", "INJ", "TIA", "SEI", "AKT", "FET", "RNDR", "FIL", "ICP", "HBAR", "VET", "ALGO", "FTM", "EOS", "ZIL", "THETA", "GRT", "ENJ", "SAND", "MANA", "AXS", "AAVE", "MKR", "COMP", "YFI", "SNX", "SUSHI", "CRV", "BAL", "CAKE", "RUNE"]);

function isCrypto(ticker: string): boolean {
  return CRYPTO_TICKERS.has(ticker.toUpperCase());
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();

  if (isCrypto(upperTicker)) {
    const quote = await getCryptoQuote(upperTicker);
    if (!quote) {
      return NextResponse.json({ ok: false, error: "No data" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      data: {
        current: quote.priceUsd,
        change1d: quote.change24h,
        change1w: quote.change7d,
        change1m: null,
        change3m: null,
        change1y: null,
        high52w: null,
        low52w: null,
      },
    });
  }

  const data = await getYahooPriceDataFull(upperTicker);
  if (!data) {
    return NextResponse.json({ ok: false, error: "No data" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}
