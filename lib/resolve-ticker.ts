/*
 * Quartly Bot — lib/resolve-ticker.ts
 * Resuelve el tipo de un ticker (stock, ETF, crypto) consultando
 * fuentes locales y APIs externas.
 */

import { SP500 } from "./sp500";
import { ETFS } from "./etfs";
import { CUSTOM_TICKERS } from "./custom-tickers";
import { CRYPTO_ID_MAP } from "./coingecko";
import { searchCrypto } from "./coingecko";

export type TickerType = "stock" | "etf" | "crypto" | "unknown";

export interface TickerInfo {
  ticker: string;
  type: TickerType;
  name: string;
  sector?: string;
}

/**
 * Resuelve el tipo de un ticker usando fuentes locales primero,
 * luego Finnhub para símbolos desconocidos.
 */
export async function resolveTicker(ticker: string): Promise<TickerInfo> {
  const upper = ticker.toUpperCase();

  /* ── Fuentes locales ─────────────────────────────────── */

  const spMatch = SP500.find((c) => c.ticker === upper);
  if (spMatch) {
    return { ticker: upper, type: "stock", name: spMatch.name, sector: spMatch.sector };
  }

  const etfMatch = ETFS.find((e) => e.ticker === upper);
  if (etfMatch) {
    return { ticker: upper, type: "etf", name: etfMatch.name, sector: etfMatch.category };
  }

  const customMatch = CUSTOM_TICKERS.find((c) => c.ticker === upper);
  if (customMatch) {
    return {
      ticker: upper,
      type: customMatch.isEtf ? "etf" : "stock",
      name: customMatch.name,
      sector: customMatch.sector,
    };
  }

  const cryptoMatch = CRYPTO_ID_MAP[upper];
  if (cryptoMatch) {
    const name = cryptoMatch.charAt(0).toUpperCase() + cryptoMatch.slice(1).replace(/-/g, " ");
    return { ticker: upper, type: "crypto", name };
  }

  /* ── Finnhub search ──────────────────────────────────── */
  try {
    const token = process.env.FINNHUB_API_KEY;
    if (token) {
      const res = await fetch(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(upper)}&token=${token}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (res.ok) {
        const data = await res.json() as { result: Array<{ symbol: string; description: string; type: string; }> };
        const match = data.result?.find((r) => r.symbol === upper);
        if (match) {
          if (match.type === "ETF") {
            return { ticker: upper, type: "etf", name: match.description || upper, sector: "ETF" };
          }
          if (match.type === "Common Stock" || match.type === "Stock" || match.type === "Equity") {
            return { ticker: upper, type: "stock", name: match.description || upper, sector: "N/A" };
          }
        }
      }
    }
  } catch {
    /* fallthrough */
  }

  /* ── CoinGecko search (fallback) ─────────────────────── */
  try {
    const results = await searchCrypto(upper);
    const match = results.find((r) => r.symbol.toUpperCase() === upper);
    if (match) {
      return { ticker: upper, type: "crypto", name: match.name };
    }
  } catch {
    /* fallthrough */
  }

  return { ticker: upper, type: "unknown", name: upper };
}

/**
 * Versión síncrona para uso en build/SSR — solo consulta fuentes locales.
 */
export function resolveTickerSync(ticker: string): TickerInfo {
  const upper = ticker.toUpperCase();

  const spMatch = SP500.find((c) => c.ticker === upper);
  if (spMatch) return { ticker: upper, type: "stock", name: spMatch.name, sector: spMatch.sector };

  const etfMatch = ETFS.find((e) => e.ticker === upper);
  if (etfMatch) return { ticker: upper, type: "etf", name: etfMatch.name, sector: etfMatch.category };

  const customMatch = CUSTOM_TICKERS.find((c) => c.ticker === upper);
  if (customMatch) return { ticker: upper, type: customMatch.isEtf ? "etf" : "stock", name: customMatch.name, sector: customMatch.sector };

  const cryptoMatch = CRYPTO_ID_MAP[upper];
  if (cryptoMatch) {
    const name = cryptoMatch.charAt(0).toUpperCase() + cryptoMatch.slice(1).replace(/-/g, " ");
    return { ticker: upper, type: "crypto", name };
  }

  return { ticker: upper, type: "unknown", name: upper };
}

/**
 * Labels en español para mostrar al usuario.
 */
export function tickerTypeLabel(type: TickerType): string {
  switch (type) {
    case "stock": return "📈 Acción";
    case "etf": return "📊 ETF";
    case "crypto": return "🪙 Crypto";
    default: return "❓ Desconocido";
  }
}
