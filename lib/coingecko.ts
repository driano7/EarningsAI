/*
 * Quartly Bot — lib/coingecko.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { CryptoQuote, CryptoHistory } from "./types";
import { getCMCQuote, isCMCEnabled } from "./coinmarketcap";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  XRP: "ripple",
  BNB: "binancecoin",
  DOGE: "dogecoin",
  LTC: "litecoin",
  TRX: "tron",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  INJ: "injective-protocol",
  TIA: "celestia",
  SEI: "sei-network",
  AKT: "akash-network",
  FET: "fetch-ai",
  RNDR: "render-token",
  FIL: "filecoin",
  ICP: "internet-computer",
  HBAR: "hedera-hashgraph",
  VET: "vechain",
  ALGO: "algorand",
  FTM: "fantom",
  EOS: "eos",
  ZIL: "zilliqa",
  THETA: "theta-token",
  GRT: "the-graph",
  ENJ: "enjincoin",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  AAVE: "aave",
  MKR: "maker",
  COMP: "compound-governance-token",
  YFI: "yearn-finance",
  SNX: "havven",
  SUSHI: "sushi",
  CRV: "curve-dao-token",
  BAL: "balancer",
  CAKE: "pancakeswap-token",
  RUNE: "thorchain",
};

export async function getCryptoQuote(ticker: string): Promise<CryptoQuote | null> {
  if (isCMCEnabled()) {
    const cmcQuote = await getCMCQuote(ticker);
    if (cmcQuote) {
      return {
        ticker: cmcQuote.symbol,
        name: cmcQuote.name,
        priceUsd: cmcQuote.price,
        change24h: cmcQuote.change24h,
        change7d: cmcQuote.change7d,
        marketCapUsd: cmcQuote.marketCap,
      };
    }
  }

  const id = CRYPTO_ID_MAP[ticker.toUpperCase()];
  if (!id) return null;

  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_market_cap=true`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as Record<string, Record<string, number>>;
    const data = json[id];
    if (!data) return null;

    return {
      ticker: ticker.toUpperCase(),
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " "),
      priceUsd: data.usd ?? 0,
      change24h: data.usd_24h_change ?? null,
      change7d: data.usd_7d_change ?? null,
      marketCapUsd: data.usd_market_cap ?? null,
    };
  } catch {
    return null;
  }
}

export async function getCryptoHistory(ticker: string, days: 30 | 90 | 365 = 30): Promise<CryptoHistory | null> {
  const id = CRYPTO_ID_MAP[ticker.toUpperCase()];
  if (!id) return null;

  try {
    const url = `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as { prices: Array<[number, number]> };
    return {
      ticker: ticker.toUpperCase(),
      prices: json.prices || [],
    };
  } catch {
    return null;
  }
}

export async function getCryptoDetails(ticker: string): Promise<{ logo: string | null; priceUsd: number | null; change24h: number | null; change7d: number | null; marketCapUsd: number | null } | null> {
  const id = CRYPTO_ID_MAP[ticker.toUpperCase()];
  if (!id) return null;

  try {
    const url = `${COINGECKO_BASE}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const image = data.image as Record<string, string> | undefined;
    const marketData = data.market_data as Record<string, unknown> | undefined;

    return {
      logo: image?.large || image?.small || image?.thumb || null,
      priceUsd: ((marketData?.current_price as Record<string, number>)?.usd) ?? null,
      change24h: ((marketData?.price_change_percentage_24h as number)) ?? null,
      change7d: ((marketData?.price_change_percentage_7d as number)) ?? null,
      marketCapUsd: ((marketData?.market_cap as Record<string, number>)?.usd) ?? null,
    };
  } catch {
    return null;
  }
}

export async function searchCrypto(query: string): Promise<Array<{ id: string; symbol: string; name: string }>> {
  if (!query.trim()) return [];

  try {
    const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = (await res.json()) as {
      coins: Array<{
        id: string;
        symbol: string;
        name: string;
        market_cap_rank?: number;
      }>;
    };
    return (json.coins || [])
      .filter((c) => c.symbol && c.name)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function formatCryptoBlock(ticker: string, name: string, quote: CryptoQuote): string {
  const priceStr = quote.priceUsd > 0 ? `$${quote.priceUsd.toFixed(2)}` : "N/A";

  let change24hStr = "N/A";
  if (quote.change24h !== null) {
    const sign = quote.change24h >= 0 ? "+" : "";
    change24hStr = `${sign}${quote.change24h.toFixed(2)}%`;
  }

  let change7dStr = "";
  if (quote.change7d !== null) {
    const sign = quote.change7d >= 0 ? "+" : "";
    change7dStr = `\n📆 Variación 7d: ${sign}${quote.change7d.toFixed(2)}%`;
  }

  const marketCapStr =
    quote.marketCapUsd !== null && quote.marketCapUsd > 0
      ? `\n🏦 Market Cap: $${(quote.marketCapUsd / 1e9).toFixed(2)}B`
      : "";

  const emoji = quote.change24h !== null ? (quote.change24h >= 0 ? "🟢" : "🔴") : "🪙";

  return `${emoji} *${ticker}* — ${name}
💵 Precio: ${priceStr}
📊 24h: ${change24hStr}${change7dStr}${marketCapStr}`;
}
