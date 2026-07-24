/*
 * Quartly Bot — lib/twelvedata.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

const BASE = "https://api.twelvedata.com";
const KEY = process.env.TWELVEDATA_API_KEY || "";

export function isTwelveDataEnabled(): boolean {
  return KEY.length > 0;
}

interface TwelveDataBar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TwelveDataResponse {
  values: TwelveDataBar[];
  meta?: { symbol: string; exchange: string; currency: string };
}

export interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVPoint {
  date: string;
  value: number;
}

export async function getTimeSeries(
  symbol: string,
  interval: "1day" | "1week" | "1month" = "1day",
  outputsize: number = 30,
): Promise<CandleData[]> {
  if (!isTwelveDataEnabled()) return [];

  const url = `${BASE}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[TwelveData] ${res.status} for ${symbol}`);
      return [];
    }
    const data: TwelveDataResponse = await res.json();
    if (!data.values || data.values.length === 0) return [];

    return data.values.map((bar) => ({
      date: bar.datetime,
      open: parseFloat(bar.open),
      high: parseFloat(bar.high),
      low: parseFloat(bar.low),
      close: parseFloat(bar.close),
      volume: parseInt(bar.volume, 10),
    }));
  } catch (err) {
    console.error(`[TwelveData] Error fetching ${symbol}:`, err);
    return [];
  }
}

export async function getSparkline(
  symbol: string,
  days: number = 30,
): Promise<number[]> {
  const candles = await getTimeSeries(symbol, "1day", days);
  return candles.reverse().map((c) => c.close);
}

export async function getHistoricalCloses(
  symbol: string,
  days: number = 365,
): Promise<OHLCVPoint[]> {
  const candles = await getTimeSeries(symbol, "1day", days);
  return candles.reverse().map((c) => ({
    date: c.date,
    value: c.close,
  }));
}

export async function getQuote(
  symbol: string,
): Promise<{ price: number; change: number; changePercent: number } | null> {
  if (!isTwelveDataEnabled()) return null;

  const url = `${BASE}/quote?symbol=${symbol}&apikey=${KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      price: parseFloat(data.price || "0"),
      change: parseFloat(data.change || "0"),
      changePercent: parseFloat(data.percent_change || "0"),
    };
  } catch {
    return null;
  }
}
