import { kv } from "@vercel/kv";

const CMC_BASE = "https://pro-api.coinmarketcap.com/v1";
const CMC_KEY = process.env.COINMARKETCAP || "";

export interface CMCCryptoQuote {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  rank: number;
}

const SYMBOL_MAP: Record<string, string> = {
  BTC: "BTC", ETH: "ETH", SOL: "SOL", ADA: "ADA", DOT: "DOT",
  AVAX: "AVAX", MATIC: "MATIC", LINK: "LINK", UNI: "UNI", ATOM: "ATOM",
  XRP: "XRP", BNB: "BNB", DOGE: "DOGE", LTC: "LTC", TRX: "TRX",
  NEAR: "NEAR", APT: "APT", ARB: "ARB", OP: "OP", SUI: "SUI",
  INJ: "INJ", TIA: "TIA", SEI: "SEI", FET: "FET", RNDR: "RNDR",
  FIL: "FIL", ICP: "ICP", HBAR: "HBAR", VET: "VET", ALGO: "ALGO",
  FTM: "FTM", EOS: "EOS", ZIL: "ZIL", THETA: "THETA", GRT: "GRT",
  ENJ: "ENJ", SAND: "SAND", MANA: "MANA", AXS: "AXS",
  AAVE: "AAVE", MKR: "MKR", COMP: "COMP", YFI: "YFI", SNX: "SNX",
  SUSHI: "SUSHI", CRV: "CRV", BAL: "BAL", CAKE: "CAKE", RUNE: "RUNE",
};

export async function getCMCQuote(ticker: string): Promise<CMCCryptoQuote | null> {
  if (!CMC_KEY) return null;

  const symbol = SYMBOL_MAP[ticker.toUpperCase()] || ticker.toUpperCase();
  const cacheKey = `cmc:quote:${symbol}`;

  const cached = await kv.get<CMCCryptoQuote>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`;
    const res = await fetch(url, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_KEY,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`CMC API error for ${symbol}:`, res.status);
      return null;
    }

    const data = await res.json();
    const cryptoData = data.data?.[symbol];
    if (!cryptoData) return null;

    const quote = cryptoData.quote?.USD;
    if (!quote) return null;

    const result: CMCCryptoQuote = {
      id: cryptoData.id?.toString() || symbol,
      name: cryptoData.name || symbol,
      symbol: cryptoData.symbol || symbol,
      price: quote.price || 0,
      change24h: quote.percent_change_24h || 0,
      change7d: quote.percent_change_7d || 0,
      marketCap: quote.market_cap || 0,
      volume24h: quote.volume_24h || 0,
      rank: cryptoData.cmc_rank || 0,
    };

    await kv.set(cacheKey, result, { ex: 300 });
    return result;
  } catch (err) {
    console.error(`CMC quote error for ${symbol}:`, err);
    return null;
  }
}

export async function getCMCQuotes(tickers: string[]): Promise<Map<string, CMCCryptoQuote>> {
  const results = new Map<string, CMCCryptoQuote>();
  if (!CMC_KEY || tickers.length === 0) return results;

  const symbols = tickers.map((t) => SYMBOL_MAP[t.toUpperCase()] || t.toUpperCase()).join(",");
  const cacheKey = `cmc:quotes:${symbols}`;

  const cached = await kv.get<Map<string, CMCCryptoQuote>>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${symbols}&convert=USD`;
    const res = await fetch(url, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_KEY,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      console.error("CMC batch quotes error:", res.status);
      return results;
    }

    const data = await res.json();

    for (const ticker of tickers) {
      const symbol = SYMBOL_MAP[ticker.toUpperCase()] || ticker.toUpperCase();
      const cryptoData = data.data?.[symbol];
      if (!cryptoData) continue;

      const quote = cryptoData.quote?.USD;
      if (!quote) continue;

      results.set(ticker, {
        id: cryptoData.id?.toString() || symbol,
        name: cryptoData.name || symbol,
        symbol: cryptoData.symbol || symbol,
        price: quote.price || 0,
        change24h: quote.percent_change_24h || 0,
        change7d: quote.percent_change_7d || 0,
        marketCap: quote.market_cap || 0,
        volume24h: quote.volume_24h || 0,
        rank: cryptoData.cmc_rank || 0,
      });
    }

    await kv.set(cacheKey, results, { ex: 300 });
  } catch (err) {
    console.error("CMC batch quotes error:", err);
  }

  return results;
}

export function isCMCEnabled(): boolean {
  return !!process.env.COINMARKETCAP;
}
