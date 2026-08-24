/*
 * Quartly Bot — lib/daily-cache.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Unified daily cache for Telegram bot commands.
 * Generated once per day, reused across /news, /superinvestors, /report, /portfolio.
 * Prices refreshed every 6h via separate cache.
 */

import { kv } from "@vercel/kv";
import { getPositions } from "./kv-portfolio";
import { getUserWatchlist, getUserCryptos } from "./kv";
import { getMacroSnapshot, type MacroSerie } from "./macro";
import { getMarketNews, getTickerNews, type NewsArticle } from "./news";
import { getAllSuperInvestorChanges, formatSuperInvestorForPrompt, type SuperInvestorChanges } from "./superinvestors";
import { getQuote } from "./finnhub";
import { getCryptoQuote } from "./coingecko";
import { checkAndConsumeRateLimit } from "./api-ratelimit";

export interface DailyCache {
  date: string; // YYYY-MM-DD
  generatedAt: number;
  macro: MacroSerie[];
  marketNews: NewsArticle[];
  superInvestors: SuperInvestorChanges[];
  aiSupernota: string | null; // Full AI-generated Supernota
}

export interface PriceCache {
  chatId: string;
  updatedAt: number;
  prices: Record<string, { current: number; change1d: number | null; source: "finnhub" | "coingecko" }>;
}

const DAILY_CACHE_TTL = 90 * 86400; // 90 days
const PRICE_CACHE_TTL = 6 * 3600; // 6 hours

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function dailyCacheKey(chatId: string): string {
  return `daily:cache:${chatId}:${todayStr()}`;
}

function priceCacheKey(chatId: string): string {
  return `price:cache:${chatId}`;
}

async function fetchAllTickers(chatId: string): Promise<string[]> {
  const { stocks, etfs } = await getUserWatchlist(chatId);
  const cryptos = await getUserCryptos(chatId);
  return [...stocks, ...etfs, ...cryptos];
}

async function fetchTickerNewsForCache(tickers: string[]): Promise<Array<{ ticker: string; articles: NewsArticle[] }>> {
  const result: Array<{ ticker: string; articles: NewsArticle[] }> = [];
  for (const ticker of tickers.slice(0, 15)) {
    const { allowed } = await checkAndConsumeRateLimit("ratelimit:news", 50);
    if (!allowed) break;
    const name = ticker; // simplified
    const articles = await getTickerNews(ticker, name, 2);
    if (articles.length > 0) {
      result.push({ ticker, articles });
    }
  }
  return result;
}

export async function getOrBuildDailyCache(chatId: string): Promise<DailyCache> {
  const key = dailyCacheKey(chatId);
  const cached = await kv.get<DailyCache>(key);
  if (cached) return cached;

  // Build fresh cache
  const tickers = await fetchAllTickers(chatId);
  const [macro, marketNews, superInvestors, tickerNews] = await Promise.all([
    getMacroSnapshot(),
    getMarketNews(10),
    getAllSuperInvestorChanges(),
    fetchTickerNewsForCache(tickers),
  ]);

  // Build AI Supernota (same as generateDailyNewsSummary but without portfolio prices)
  let aiSupernota: string | null = null;
  try {
    const { generateAISupernota } = await import("./news-summary");
    const prices = await fetchCurrentPrices(tickers);
    aiSupernota = await generateAISupernota(todayStr(), macro, marketNews, tickerNews, prices, tickers, superInvestors);
  } catch {
    // AI failed, will use fallback
  }

  const cache: DailyCache = {
    date: todayStr(),
    generatedAt: Date.now(),
    macro,
    marketNews,
    superInvestors,
    aiSupernota,
  };

  await kv.set(key, cache, { ex: DAILY_CACHE_TTL });
  return cache;
}

async function fetchCurrentPrices(tickers: string[]): Promise<Array<{ ticker: string; current: number; change: number | null; prevClose: number | null }>> {
  const prices: Array<{ ticker: string; current: number; change: number | null; prevClose: number | null }> = [];
  for (const ticker of tickers.slice(0, 20)) {
    const { allowed } = await checkAndConsumeRateLimit("ratelimit:finnhub", 60);
    if (!allowed) break;
    try {
      const quote = await getQuote(ticker);
      if (quote && quote.c > 0) {
        const change = quote.pc > 0 ? ((quote.c - quote.pc) / quote.pc) * 100 : null;
        prices.push({ ticker, current: quote.c, change, prevClose: quote.pc > 0 ? quote.pc : null });
      }
    } catch {
      // skip
    }
  }
  return prices;
}

export async function getOrBuildPriceCache(chatId: string): Promise<PriceCache> {
  const key = priceCacheKey(chatId);
  const cached = await kv.get<PriceCache>(key);
  const now = Date.now();
  const sixHours = 6 * 3600 * 1000;

  if (cached && (now - cached.updatedAt) < sixHours) {
    return cached;
  }

  // Refresh prices
  const tickers = await fetchAllTickers(chatId);
  const prices: Record<string, { current: number; change1d: number | null; source: "finnhub" | "coingecko" }> = {};

  for (const ticker of tickers) {
    try {
      let current: number | null = null;
      let change1d: number | null = null;
      let source: "finnhub" | "coingecko" = "finnhub";

      // Check if crypto
      const cryptoQuote = await getCryptoQuote(ticker);
      if (cryptoQuote && cryptoQuote.priceUsd > 0) {
        current = cryptoQuote.priceUsd;
        change1d = cryptoQuote.change24h;
        source = "coingecko";
      } else {
        const quote = await getQuote(ticker);
        if (quote && quote.c > 0) {
          current = quote.c;
          change1d = typeof quote.dp === "number" ? quote.dp : null;
          source = "finnhub";
        }
      }

      if (current !== null) {
        prices[ticker] = { current, change1d, source };
      }
    } catch {
      // skip
    }
  }

  const priceCache: PriceCache = { chatId, updatedAt: now, prices };
  await kv.set(key, priceCache, { ex: PRICE_CACHE_TTL });
  return priceCache;
}

export async function getCachedSuperInvestors(): Promise<SuperInvestorChanges[]> {
  const key = `daily:superinvestors:${todayStr()}`;
  const cached = await kv.get<SuperInvestorChanges[]>(key);
  if (cached) return cached;

  const changes = await getAllSuperInvestorChanges();
  await kv.set(key, changes, { ex: DAILY_CACHE_TTL });
  return changes;
}

export function formatSuperInvestorsForTelegram(changes: SuperInvestorChanges[]): string {
  if (changes.length === 0) return "⚠️ Sin datos 13F disponibles.";
  let msg = `🏛 *SMART MONEY — Movimientos 13F (${todayStr()})*\n\n`;
  for (const s of changes) {
    msg += formatSuperInvestorForPrompt(s);
  }
  msg += `\n_📊 Datos: SEC EDGAR | Cache diario_`;
  return msg;
}

export function formatMacroForTelegram(macro: MacroSerie[]): string {
  if (macro.length === 0) return "📉 Sin datos macro.";
  let msg = `📊 *MACRO (FRED)*\n`;
  for (const m of macro) {
    if (m.value === null) continue;
    const change = m.change !== null ? `${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}` : "N/A";
    const arrow = m.change !== null ? (m.change > 0 ? "📈" : m.change < 0 ? "📉" : "➖") : "➖";
    msg += `${arrow} ${m.label}: ${m.value}${m.unit} (${change})\n`;
  }
  return msg;
}

export function formatMarketNewsForTelegram(news: NewsArticle[]): string {
  if (news.length === 0) return "📰 Sin noticias de mercado.";
  let msg = `📰 *MERCADO*\n`;
  for (const article of news.slice(0, 5)) {
    msg += `• ${article.title}\n`;
  }
  return msg;
}