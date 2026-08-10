/*
 * Quartly Bot — app/api/strategy/calculate/route.ts
 * AI Strategy Visualizer — descarga OHLCV, calcula indicadores (puro TypeScript)
 * y detecta señales de entrada/salida.
 * Copyright (c) Donovan Riaño. All rights reserved.
 */

import { NextRequest, NextResponse } from "next/server";
import { CRYPTO_ID_MAP } from "@/lib/coingecko";
import type {
  AssetType,
  ChartSeries,
  Interval,
  OHLCVBar,
  SignalPoint,
  StrategyJSON,
} from "@/lib/strategy-types";

const YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const TWELVE_URL = "https://api.twelvedata.com/time_series";
const FINNHUB_URL = "https://finnhub.io/api/v1/stock/candle";
const COINGECKO_URL = "https://api.coingecko.com/api/v3";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/* ─────────────────────────── OHLCV fetchers ─────────────────────────── */

const YAHOO_INTERVALS: Record<Interval, string> = { "1d": "1d", "1h": "60m", "4h": "4h", "1w": "1wk" };
const TWELVE_INTERVALS: Record<Interval, string> = { "1d": "1day", "1h": "1h", "4h": "4h", "1w": "1week" };
const FINNHUB_INTERVALS: Partial<Record<Interval, string>> = { "1d": "D", "1h": "60", "1w": "W" };

const INTERVAL_SECONDS: Record<Interval, number> = { "1d": 86400, "1h": 3600, "4h": 14400, "1w": 604800 };

function yahooRange(bars: number): string {
  if (bars <= 5) return "5d";
  if (bars <= 30) return "1mo";
  if (bars <= 90) return "3mo";
  if (bars <= 180) return "6mo";
  if (bars <= 365) return "1y";
  if (bars <= 730) return "2y";
  return "5y";
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function fetchYahoo(ticker: string, interval: Interval, bars: number): Promise<OHLCVBar[] | null> {
  const iv = YAHOO_INTERVALS[interval];
  const range = yahooRange(bars);
  const url = `${YAHOO_URL}/${encodeURIComponent(ticker)}?interval=${iv}&range=${range}`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<Record<string, Array<number | null>>> } }> };
    };
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps || !quote) return null;

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const rows: OHLCVBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (typeof close !== "number" || !Number.isFinite(close)) continue;
      rows.push({
        time: timestamps[i],
        open: toNumber(opens[i]),
        high: toNumber(highs[i]),
        low: toNumber(lows[i]),
        close,
        volume: toNumber(volumes[i]),
      });
    }
    return rows.slice(-bars);
  } catch {
    return null;
  }
}

function parseTwelveTime(value: string): number {
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return Math.floor(Date.parse(s + "T00:00:00Z") / 1000);
  }
  return Math.floor(Date.parse(s.replace(" ", "T") + "Z") / 1000);
}

async function fetchTwelve(ticker: string, interval: Interval, bars: number): Promise<OHLCVBar[] | null> {
  const key = process.env.TWELVE || "";
  if (!key) return null;
  const iv = TWELVE_INTERVALS[interval];
  const outputsize = Math.min(Math.max(bars, 5), 500);
  const url = `${TWELVE_URL}?symbol=${encodeURIComponent(ticker)}&interval=${iv}&outputsize=${outputsize}&apikey=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume: string }>;
    };
    if (data?.status === "error" || !Array.isArray(data?.values) || data.values.length === 0) return null;

    // API devuelve las velas más recientes primero.
    return data.values.slice(0, bars).reverse().map((bar) => ({
      time: parseTwelveTime(bar.datetime),
      open: parseFloat(bar.open) || 0,
      high: parseFloat(bar.high) || 0,
      low: parseFloat(bar.low) || 0,
      close: parseFloat(bar.close) || 0,
      volume: parseFloat(bar.volume) || 0,
    }));
  } catch {
    return null;
  }
}

async function fetchFinnhub(ticker: string, interval: Interval, bars: number): Promise<OHLCVBar[] | null> {
  const key = process.env.FINNHUB_API_KEY || "";
  const resolution = FINNHUB_INTERVALS[interval];
  if (!key || !resolution) return null;

  const to = Math.floor(Date.now() / 1000);
  const seconds = INTERVAL_SECONDS[interval];
  const from = to - bars * seconds;
  const url = `${FINNHUB_URL}?symbol=${encodeURIComponent(ticker)}&resolution=${resolution}&from=${from}&to=${to}&token=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] };
    if (data?.s !== "ok" || !data.t || !data.c) return null;

    const rows: OHLCVBar[] = [];
    for (let i = 0; i < data.t.length; i++) {
      rows.push({
        time: data.t[i],
        open: toNumber(data.o?.[i]),
        high: toNumber(data.h?.[i]),
        low: toNumber(data.l?.[i]),
        close: toNumber(data.c[i]),
        volume: toNumber(data.v?.[i]),
      });
    }
    return rows.slice(-bars);
  } catch {
    return null;
  }
}

async function fetchCrypto(ticker: string, bars: number): Promise<OHLCVBar[] | null> {
  const id = CRYPTO_ID_MAP[ticker.toUpperCase()] || ticker.toLowerCase();
  const url = `${COINGECKO_URL}/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=365`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Array<[number, number, number, number, number]> | { error?: string };
    if (!Array.isArray(data) || data.length === 0) return null;

    // CoinGecko /ohlc no incluye volumen → 0.
    return data
      .map(([ms, open, high, low, close]) => ({
        time: Math.round(ms / 1000),
        open,
        high,
        low,
        close,
        volume: 0,
      }))
      .slice(-bars);
  } catch {
    return null;
  }
}

async function fetchOHLCV(ticker: string, assetType: AssetType, interval: Interval, bars: number): Promise<OHLCVBar[]> {
  if (assetType === "crypto") {
    const rows = await fetchCrypto(ticker, bars);
    if (rows && rows.length > 0) return rows;
    throw new Error(`No se obtuvieron datos OHLCV para ${ticker} (CoinGecko).`);
  }

  const yahoo = await fetchYahoo(ticker, interval, bars);
  if (yahoo && yahoo.length > 0) return yahoo;

  const twelve = await fetchTwelve(ticker, interval, bars);
  if (twelve && twelve.length > 0) return twelve;

  const finnhub = await fetchFinnhub(ticker, interval, bars);
  if (finnhub && finnhub.length > 0) return finnhub;

  throw new Error(`No se obtuvieron datos OHLCV para ${ticker} (Yahoo/TwelveData/Finnhub).`);
}

/* ─────────────────────── Indicadores (puro TS) ─────────────────────── */

function ema(values: number[], period: number): number[] {
  const n = values.length;
  const alpha = 2 / (period + 1);
  const out = new Array<number>(n).fill(NaN);
  if (n === 0) return out;

  let seed = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(values[i])) {
      seed = i;
      break;
    }
  }
  if (seed === -1) return out;
  out[seed] = values[seed];
  for (let i = seed + 1; i < n; i++) {
    out[i] = !Number.isFinite(values[i]) ? out[i - 1] : alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

function sma(values: number[], period: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(NaN);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function rsi(values: number[], period: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(NaN);
  if (n <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < n; i++) {
    const diff = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macd(values: number[]): { macdLine: number[]; signal: number[] } {
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdLine = ema12.map((v, i) => (Number.isFinite(v) && Number.isFinite(ema26[i]) ? v - ema26[i] : NaN));
  const signal = ema(macdLine, 9);
  return { macdLine, signal };
}

function standardDeviation(values: number[], from: number, to: number, mean: number): number {
  let acc = 0;
  for (let i = from; i <= to; i++) acc += Math.pow(values[i] - mean, 2);
  return Math.sqrt(acc / (to - from + 1));
}

function bbands(values: number[], period: number): { upper: number[]; mid: number[]; lower: number[] } {
  const n = values.length;
  const mid = sma(values, period);
  const upper = new Array<number>(n).fill(NaN);
  const lower = new Array<number>(n).fill(NaN);
  for (let i = period - 1; i < n; i++) {
    const m = mid[i];
    const std = standardDeviation(values, i - period + 1, i, m);
    upper[i] = m + 2 * std;
    lower[i] = m - 2 * std;
  }
  return { upper, mid, lower };
}

function atr(high: number[], low: number[], close: number[], period: number): number[] {
  const n = close.length;
  const tr = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr[i] = high[i] - low[i];
    } else {
      tr[i] = Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      );
    }
  }

  const out = new Array<number>(n).fill(NaN);
  if (n <= period) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  out[period] = sum / period;
  for (let i = period + 1; i < n; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

function vwap(high: number[], low: number[], close: number[], volume: number[]): number[] {
  const n = close.length;
  const out = new Array<number>(n).fill(NaN);
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < n; i++) {
    const typical = (high[i] + low[i] + close[i]) / 3;
    const vol = Number.isFinite(volume[i]) ? volume[i] : 0;
    cumPV += typical * vol;
    cumVol += vol;
    // Sin volumen (p.ej. cripto) se usa el precio típico como aproximación.
    out[i] = cumVol > 0 ? cumPV / cumVol : typical;
  }
  return out;
}

interface InternalSeries {
  name: string;
  color: string;
  panel: "main" | "sub";
  values: number[];
}

function calculateSeries(ohlcv: OHLCVBar[], indicators: StrategyJSON["indicators"]): InternalSeries[] {
  const closes = ohlcv.map((b) => b.close);
  const highs = ohlcv.map((b) => b.high);
  const lows = ohlcv.map((b) => b.low);
  const volumes = ohlcv.map((b) => b.volume);

  const result: InternalSeries[] = [];
  for (const ind of indicators) {
    const type = (ind.type || "EMA").toUpperCase();
    const periodNum = ind.params?.period;
    const period = typeof periodNum === "number" && periodNum > 0 ? Math.round(periodNum) : 14;
    const color = ind.color || "#2196F3";
    const panel: "main" | "sub" = ind.panel === "sub" ? "sub" : "main";

    switch (type) {
      case "EMA":
        result.push({ name: `EMA_${period}`, color, panel, values: ema(closes, period) });
        break;
      case "SMA":
        result.push({ name: `SMA_${period}`, color, panel, values: sma(closes, period) });
        break;
      case "RSI":
        result.push({ name: `RSI_${period}`, color, panel, values: rsi(closes, period) });
        break;
      case "MACD": {
        const { macdLine, signal } = macd(closes);
        result.push({ name: "MACD", color, panel, values: macdLine });
        result.push({ name: "MACD_SIGNAL", color, panel, values: signal });
        break;
      }
      case "BB": {
        const { upper, mid, lower } = bbands(closes, period);
        result.push({ name: "BB_UPPER", color, panel, values: upper });
        result.push({ name: "BB_MID", color, panel, values: mid });
        result.push({ name: "BB_LOWER", color, panel, values: lower });
        break;
      }
      case "ATR":
        result.push({ name: `ATR_${period}`, color, panel, values: atr(highs, lows, closes, period) });
        break;
      case "VWAP":
        result.push({ name: "VWAP", color, panel, values: vwap(highs, lows, closes, volumes) });
        break;
      case "VOLUME":
        result.push({ name: "VOLUME_SMA_20", color, panel, values: sma(volumes, 20) });
        break;
      default:
        break;
    }
  }
  return result;
}

/* ─────────────────────── Detección de señales ─────────────────────── */

function buildLookup(series: InternalSeries[], index: number, bar: OHLCVBar): Record<string, number> {
  const lookup: Record<string, number> = {
    OPEN: bar.open,
    HIGH: bar.high,
    LOW: bar.low,
    CLOSE: bar.close,
    VOLUME: bar.volume,
  };
  for (const s of series) {
    lookup[s.name] = s.values[index];
  }
  return lookup;
}

function resolve(key: string, lookup: Record<string, number>): number {
  if (Object.prototype.hasOwnProperty.call(lookup, key)) {
    return lookup[key];
  }
  const num = Number(key);
  return Number.isNaN(num) ? NaN : num;
}

function rulePasses(
  rule: StrategyJSON["entry_rules"][number],
  cur: Record<string, number>,
  prev: Record<string, number>
): boolean {
  const leftCur = resolve(rule.left, cur);
  const rightCur = resolve(rule.right, cur);
  if (!Number.isFinite(leftCur) || !Number.isFinite(rightCur)) return false;

  switch (rule.operator) {
    case ">":
      return leftCur > rightCur;
    case "<":
      return leftCur < rightCur;
    case ">=":
      return leftCur >= rightCur;
    case "<=":
      return leftCur <= rightCur;
    case "crosses_above": {
      const leftPrev = resolve(rule.left, prev);
      const rightPrev = resolve(rule.right, prev);
      return Number.isFinite(leftPrev) && Number.isFinite(rightPrev) && leftPrev <= rightPrev && leftCur > rightCur;
    }
    case "crosses_below": {
      const leftPrev = resolve(rule.left, prev);
      const rightPrev = resolve(rule.right, prev);
      return Number.isFinite(leftPrev) && Number.isFinite(rightPrev) && leftPrev >= rightPrev && leftCur < rightCur;
    }
    default:
      return false;
  }
}

function detectSignals(
  ohlcv: OHLCVBar[],
  series: InternalSeries[],
  strategy: StrategyJSON
): SignalPoint[] {
  const signals: SignalPoint[] = [];
  const hasEntry = Array.isArray(strategy.entry_rules) && strategy.entry_rules.length > 0;
  const hasExit = Array.isArray(strategy.exit_rules) && strategy.exit_rules.length > 0;
  if (!hasEntry && !hasExit) return signals;

  for (let i = 1; i < ohlcv.length; i++) {
    const cur = buildLookup(series, i, ohlcv[i]);
    const prev = buildLookup(series, i - 1, ohlcv[i - 1]);

    if (hasEntry && strategy.entry_rules.every((r) => rulePasses(r, cur, prev))) {
      signals.push({ time: ohlcv[i].time, type: "buy", price: ohlcv[i].close, reason: "entry" });
    }
    if (hasExit && strategy.exit_rules.every((r) => rulePasses(r, cur, prev))) {
      signals.push({ time: ohlcv[i].time, type: "sell", price: ohlcv[i].close, reason: "exit" });
    }
  }
  return signals;
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;

function toChartSeries(series: InternalSeries[], ohlcv: OHLCVBar[]): ChartSeries[] {
  return series.map((s) => ({
    name: s.name,
    color: s.color,
    panel: s.panel,
    data: ohlcv.map((bar, i) => ({
      time: bar.time,
      value: Number.isFinite(s.values[i]) ? round4(s.values[i]) : NaN,
    })),
  }));
}

/* ─────────────────────────────── Handler ─────────────────────────────── */

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<{
    ticker: string;
    assetType: AssetType;
    interval: Interval;
    bars: number;
    strategy: StrategyJSON;
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const ticker = (typeof body.ticker === "string" ? body.ticker : "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker is required" }, { status: 400 });
  }
  const assetType: AssetType = body.assetType === "crypto" || body.assetType === "etf" ? body.assetType : "stock";
  const interval: Interval = body.interval === "1h" || body.interval === "4h" || body.interval === "1w" ? body.interval : "1d";
  const bars =
    typeof body.bars === "number" && Number.isFinite(body.bars) && body.bars > 0
      ? Math.min(Math.max(Math.round(body.bars), 5), 500)
      : 365;
  const strategy: StrategyJSON =
    body.strategy && Array.isArray(body.strategy.indicators) ? body.strategy : { indicators: [], entry_rules: [], exit_rules: [] };

  try {
    const ohlcv = await fetchOHLCV(ticker, assetType, interval, bars);
    if (ohlcv.length === 0) {
      return NextResponse.json({ ok: false, error: `Sin datos OHLCV para ${ticker}.` }, { status: 404 });
    }

    const internal = calculateSeries(ohlcv, strategy.indicators);
    const series = toChartSeries(internal, ohlcv);
    const signals = detectSignals(ohlcv, internal, strategy);

    return NextResponse.json({ ohlcv, series, signals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}