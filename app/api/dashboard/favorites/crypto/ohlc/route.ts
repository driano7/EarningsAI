/*
 * Quartly Bot — app/api/dashboard/favorites/crypto/ohlc/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const COINGECKO_MAP: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano",
  DOT: "polkadot", AVAX: "avalanche-2", MATIC: "matic-network",
  LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos",
  XRP: "ripple", BNB: "binancecoin", DOGE: "dogecoin",
  LTC: "litecoin", TRX: "tron", NEAR: "near",
};

const periodToDays: Record<string, string> = { "1d": "1", "1w": "7", "1m": "30", "3m": "90", "6m": "180", "1y": "365", "3y": "max" };

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const period = req.nextUrl.searchParams.get("period") || "1m";
  if (!ticker) return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  const days = periodToDays[period] || "30";
  const id = COINGECKO_MAP[ticker];
  if (!id) return NextResponse.json({ ok: false, error: "Unsupported crypto" }, { status: 404 });
  const cacheKey = `crypto:ohlc:${ticker}:${period}`;
  const cached = await kv.get(cacheKey);
  if (cached) return NextResponse.json({ ok: true, data: cached });

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("coingecko ohlc failed");
    const data = await res.json() as number[][];
    // data: [timestamp, open, high, low, close]
    const ohlc = data.map(([ts, o, h, l, c]) => ({
      date: new Date(ts).toISOString().split("T")[0],
      open: o, high: h, low: l, close: c,
    }));
    await kv.set(cacheKey, ohlc, { ex: 3600 });
    return NextResponse.json({ ok: true, data: ohlc });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
