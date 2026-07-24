/*
 * Quartly Bot — lib/gs-quant.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Inspired by Goldman Sachs gs-quant (Python) — ported to TypeScript
 */

/* ═══════════════════════════════════════════════════════════════
   TIME SERIES
   ═══════════════════════════════════════════════════════════════ */

/** Simple returns: (p₁ - p₀) / p₀ */
export function returns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r.push(prices[i - 1] !== 0 ? (prices[i] - prices[i - 1]) / prices[i - 1] : 0);
  }
  return r;
}

/** Log returns: ln(p₁ / p₀) */
export function logReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r.push(prices[i - 1] > 0 && prices[i] > 0 ? Math.log(prices[i] / prices[i - 1]) : 0);
  }
  return r;
}

/** Simple Moving Average */
export function sma(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += data[j];
    result.push(sum / window);
  }
  return result;
}

/** Exponential Moving Average */
export function ema(data: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const result: number[] = [];
  let prev = data[0] ?? 0;
  for (let i = 0; i < data.length; i++) {
    if (i === 0) { result.push(data[0]); continue; }
    prev = alpha * data[i] + (1 - alpha) * prev;
    result.push(prev);
  }
  return result;
}

/** Rolling windowed standard deviation (annualized by default) */
export function rollingVolatility(returns: number[], window: number, periodsPerYear = 365): number[] {
  const result: number[] = [];
  for (let i = 0; i < returns.length; i++) {
    if (i < window - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += returns[j];
    const mean = sum / window;
    let sqSum = 0;
    for (let j = i - window + 1; j <= i; j++) sqSum += (returns[j] - mean) ** 2;
    result.push(Math.sqrt(sqSum / (window - 1)) * Math.sqrt(periodsPerYear));
  }
  return result;
}

/** Rolling correlation between two return series */
export function rollingCorrelation(r1: number[], r2: number[], window: number): number[] {
  const result: number[] = [];
  const len = Math.min(r1.length, r2.length);
  for (let i = 0; i < len; i++) {
    if (i < window - 1) { result.push(NaN); continue; }
    const s1: number[] = [], s2: number[] = [];
    for (let j = i - window + 1; j <= i; j++) { s1.push(r1[j]); s2.push(r2[j]); }
    const m1 = s1.reduce((a, b) => a + b, 0) / window;
    const m2 = s2.reduce((a, b) => a + b, 0) / window;
    let num = 0, d1 = 0, d2 = 0;
    for (let k = 0; k < window; k++) {
      const d1k = s1[k] - m1, d2k = s2[k] - m2;
      num += d1k * d2k;
      d1 += d1k ** 2;
      d2 += d2k ** 2;
    }
    const denom = Math.sqrt(d1 * d2);
    result.push(denom !== 0 ? num / denom : 0);
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   RISK / RETURN ANALYTICS
   ═══════════════════════════════════════════════════════════════ */

/** Sharpe ratio (annualized) */
export function sharpeRatio(returns: number[], riskFree = 0.05, periodsPerYear = 365): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const excess = mean - riskFree / periodsPerYear;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  return std !== 0 ? (excess / std) * Math.sqrt(periodsPerYear) : 0;
}

/** Sortino ratio (downside deviation only) */
export function sortinoRatio(returns: number[], riskFree = 0.05, targetReturn = 0, periodsPerYear = 365): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const excess = mean - riskFree / periodsPerYear;
  const downside = returns.reduce((s, r) => {
    const d = Math.min(r - targetReturn, 0);
    return s + d * d;
  }, 0);
  const downsideStd = Math.sqrt(downside / (returns.length - 1));
  return downsideStd !== 0 ? (excess / downsideStd) * Math.sqrt(periodsPerYear) : 0;
}

/** Maximum drawdown (as positive percentage, e.g. 0.25 = -25%) */
export function maxDrawdown(prices: number[]): number {
  let peak = prices[0] ?? 0;
  let maxDd = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = peak > 0 ? (peak - p) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

/** Full drawdown series */
export function drawdownSeries(prices: number[]): number[] {
  const dd: number[] = [];
  let peak = prices[0] ?? 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    dd.push(peak > 0 ? (peak - p) / peak : 0);
  }
  return dd;
}

/** Compound Annual Growth Rate */
export function cagr(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0;
  return (endValue / startValue) ** (1 / years) - 1;
}

/** Annualized volatility */
export function annualizedVolatility(returns: number[], periodsPerYear = 365): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

/** Calmar ratio: annualized return / max drawdown */
export function calmarRatio(annualReturn: number, maxDd: number): number {
  return maxDd !== 0 ? annualReturn / maxDd : 0;
}

/* ═══════════════════════════════════════════════════════════════
   STATISTICS / RELATIONSHIPS
   ═══════════════════════════════════════════════════════════════ */

/** Pearson correlation coefficient */
export function correlation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const dxi = x[i] - mx, dyi = y[i] - my;
    num += dxi * dyi;
    dx += dxi ** 2;
    dy += dyi ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom !== 0 ? num / denom : 0;
}

/** Beta: covariance(asset, benchmark) / variance(benchmark) */
export function beta(assetReturns: number[], benchmarkReturns: number[]): number {
  const n = Math.min(assetReturns.length, benchmarkReturns.length);
  const ma = assetReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const mb = benchmarkReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let cov = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = assetReturns[i] - ma;
    const db = benchmarkReturns[i] - mb;
    cov += da * db;
    varB += db ** 2;
  }
  return varB !== 0 ? cov / varB : 0;
}

/** Alpha (Jensen's alpha) */
export function alpha(assetReturns: number[], benchmarkReturns: number[], riskFree = 0.05, periodsPerYear = 365): number {
  const b = beta(assetReturns, benchmarkReturns);
  const meanAsset = assetReturns.reduce((a, b) => a + b, 0) / assetReturns.length;
  const meanBench = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
  const rf = riskFree / periodsPerYear;
  return meanAsset - rf - b * (meanBench - rf);
}

/** R-squared from correlation */
export function rSquared(x: number[], y: number[]): number {
  const c = correlation(x, y);
  return c * c;
}

/** Ordinary Least Squares linear regression */
export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(x.length, y.length);
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, denom = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    num += dx * (y[i] - my);
    denom += dx ** 2;
  }
  const slope = denom !== 0 ? num / denom : 0;
  const intercept = my - slope * mx;
  const r2 = rSquared(x, y);
  return { slope, intercept, r2 };
}

/** Z-score normalization */
export function zScore(data: number[]): number[] {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const std = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / data.length);
  return data.map((v) => std !== 0 ? (v - mean) / std : 0);
}

/** Percentile (0-100) */
export function percentile(data: number[], p: number): number {
  const sorted = [...data].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

/* ═══════════════════════════════════════════════════════════════
   FORMATTING HELPERS
   ═══════════════════════════════════════════════════════════════ */

export function formatRatio(value: number): string {
  return value.toFixed(2);
}

export function formatCorrelation(value: number): string {
  return value.toFixed(4);
}

export function formatDrawdown(value: number): string {
  return `-${(value * 100).toFixed(2)}%`;
}

export function formatSharpe(value: number): string {
  if (value >= 2) return `🟢 ${value.toFixed(2)} (Excelente)`;
  if (value >= 1) return `✅ ${value.toFixed(2)} (Bueno)`;
  if (value >= 0) return `⚠️ ${value.toFixed(2)} (Aceptable)`;
  return `🔴 ${value.toFixed(2)} (Malo)`;
}
