/*
 * Quartly Bot — lib/per.ts
 * PER (P/E) ratio via Finnhub + TwelveData fallback
 */

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";
const TWELVE_KEY = process.env.TWELVE || "";

export async function getPER(ticker: string): Promise<number | null> {
  const t = ticker.toUpperCase();
  // Try Finnhub metric first
  if (FINNHUB_KEY) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(t)}&metric=all&token=${FINNHUB_KEY}`);
      if (res.ok) {
        const data = await res.json() as any;
        const m = data?.metric;
        if (m) {
          const v = m.peBasicExclExtraTTM ?? m.peExclExtraTTM ?? m.peTTM ?? m.peAnnual ?? m.peNormalizedAnnual;
          if (typeof v === "number" && isFinite(v) && v > 0 && v < 1000) return v;
        }
      }
    } catch {}
  }
  // Fallback TwelveData quote (has pe)
  if (TWELVE_KEY) {
    try {
      const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(t)}&apikey=${TWELVE_KEY}`);
      if (res.ok) {
        const data = await res.json() as any;
        const v = parseFloat(data?.pe ?? data?.trailing_pe ?? "");
        if (isFinite(v) && v > 0 && v < 1000) return v;
      }
    } catch {}
  }
  return null;
}

export async function getPERMap(tickers: string[]): Promise<Record<string, number | null>> {
  const entries = await Promise.all(tickers.map(async (t) => [t, await getPER(t)] as const));
  return Object.fromEntries(entries);
}
