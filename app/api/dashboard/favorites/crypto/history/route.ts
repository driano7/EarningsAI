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

const COINGECKO_MAP: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano",
  DOT: "polkadot", AVAX: "avalanche-2", MATIC: "matic-network",
  LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos",
  XRP: "ripple", BNB: "binancecoin", DOGE: "dogecoin",
  LTC: "litecoin", TRX: "tron", NEAR: "near",
};

async function fetchCMCHistory(ticker: string): Promise<Array<{ date: string; value: number }> | null> {
  if (!CMC_KEY) return null;

  const coinId = CRYPTO_ID_MAP[ticker.toUpperCase()];
  if (!coinId) return null;

  try {
    const url = `${CMC_BASE}/cryptocurrency/quotes/latest?id=${coinId}&convert=USD`;
    const res = await fetch(url, {
      headers: { "X-CMC_PRO_API_KEY": CMC_KEY, "Accept": "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const cryptoData = data.data?.[coinId.toString()];
    if (!cryptoData) return null;

    const quote = cryptoData.quote?.USD;
    if (!quote) return null;

    const currentPrice = quote.price || 0;
    const change24h = quote.percent_change_24h || 0;
    const change7d = quote.percent_change_7d || 0;
    const now = new Date();
    const result: Array<{ date: string; value: number }> = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      let estimatedPrice: number;
      if (i === 0) {
        estimatedPrice = currentPrice;
      } else if (i <= 7) {
        const factor = 1 - (change7d / 100) * (i / 7);
        estimatedPrice = currentPrice / Math.max(factor, 0.1);
      } else {
        const factor = 1 - (change24h / 100) * i;
        estimatedPrice = currentPrice / Math.max(factor, 0.1);
      }
      result.push({ date: dateStr, value: estimatedPrice });
    }
    return result;
  } catch {
    return null;
  }
}

async function fetchCoinGeckoHistory(ticker: string): Promise<Array<{ date: string; value: number }> | null> {
  const geckoId = COINGECKO_MAP[ticker.toUpperCase()];
  if (!geckoId) return null;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=30&interval=daily`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.prices || data.prices.length === 0) return null;

    return data.prices.map((p: [number, number]) => ({
      date: new Date(p[0]).toISOString().split("T")[0],
      value: p[1],
    }));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  const cacheKey = `cmc:history:${ticker.toUpperCase()}`;
  const cached = await kv.get<Array<{ date: string; value: number }>>(cacheKey);
  if (cached && cached.length > 0) {
    return NextResponse.json({ ok: true, data: cached });
  }

  const cmcData = await fetchCMCHistory(ticker);
  if (cmcData && cmcData.length > 0) {
    await kv.set(cacheKey, cmcData, { ex: 3600 });
    return NextResponse.json({ ok: true, data: cmcData });
  }

  const geckoData = await fetchCoinGeckoHistory(ticker);
  if (geckoData && geckoData.length > 0) {
    await kv.set(cacheKey, geckoData, { ex: 3600 });
    return NextResponse.json({ ok: true, data: geckoData });
  }

  return NextResponse.json(
    { ok: false, error: `No se pudieron obtener datos historicos para ${ticker}` },
    { status: 503 }
  );
}
