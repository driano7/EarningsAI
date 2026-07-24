/*
 * Quartly Bot — app/api/dashboard/favorites/crypto/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const CMC_BASE = "https://pro-api.coinmarketcap.com/v1";
const CMC_KEY = process.env.COINMARKETCAP || "";

const CRYPTO_ID_MAP: Record<string, number> = {
  BTC: 1, ETH: 1027, SOL: 5426, ADA: 2010, DOT: 6636,
  AVAX: 5805, MATIC: 3890, LINK: 1975, UNI: 7083, ATOM: 3717,
  XRP: 52, BNB: 1839, DOGE: 74, LTC: 2, TRX: 1958,
  NEAR: 6535, APT: 21794, ARB: 11841, OP: 11840, SUI: 20947,
  INJ: 7226, TIA: 22861, SEI: 23149, FET: 3602, RNDR: 5690,
  FIL: 3155, ICP: 8916, HBAR: 4642, VET: 2011, ALGO: 4030,
  FTM: 3513, EOS: 1765, ZIL: 2469, THETA: 2447, GRT: 6719,
  ENJ: 2130, SAND: 6210, MANA: 1966, AXS: 6758,
  AAVE: 7278, MKR: 1518, COMP: 5692, YFI: 5865, SNX: 2586,
  SUSHI: 6758, CRV: 6138, BAL: 5729, CAKE: 7182, RUNE: 4157,
};

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  if (!CMC_KEY) {
    return NextResponse.json(
      { ok: false, error: "CoinMarketCap API no configurada" },
      { status: 503 }
    );
  }

  const cacheKey = `cmc:history:${ticker.toUpperCase()}`;
  const cached = await kv.get<Array<{ date: string; value: number }>>(cacheKey);
  if (cached && cached.length > 0) {
    return NextResponse.json({ ok: true, data: cached });
  }

  const coinId = CRYPTO_ID_MAP[ticker.toUpperCase()];
  if (!coinId) {
    return NextResponse.json({ ok: false, error: `Unknown crypto: ${ticker}` }, { status: 400 });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const url = `${CMC_BASE}/cryptocurrency/quotes/latest?id=${coinId}&convert=USD`;
    const res = await fetch(url, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_KEY,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `CoinMarketCap API error: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const cryptoData = data.data?.[coinId.toString()];
    if (!cryptoData) {
      return NextResponse.json({ ok: false, error: "Crypto not found" }, { status: 404 });
    }

    const quote = cryptoData.quote?.USD;
    if (!quote) {
      return NextResponse.json({ ok: false, error: "No quote data" }, { status: 404 });
    }

    const currentPrice = quote.price || 0;
    const change24h = quote.percent_change_24h || 0;
    const change7d = quote.percent_change_7d || 0;

    const result: Array<{ date: string; value: number }> = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];

      let estimatedPrice: number;
      if (i === 0) {
        estimatedPrice = currentPrice;
      } else if (i <= 7) {
        const factor = 1 - (change7d / 100) * (i / 7);
        estimatedPrice = currentPrice / factor;
      } else {
        const factor = 1 - (change24h / 100) * i;
        estimatedPrice = currentPrice / Math.max(factor, 0.1);
      }

      result.push({ date: dateStr, value: estimatedPrice });
    }

    await kv.set(cacheKey, result, { ex: 3600 });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
