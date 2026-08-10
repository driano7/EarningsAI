/*
 * Quartly Bot — lib/news.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";
import { checkAndConsumeRateLimit } from "./api-ratelimit";
import { getFinnhubCompanyNews } from "./finnhub";

const NEWS_API_KEY = process.env.NEWS || "";
const BASE = "https://newsapi.org/v2/everything";
const NEWS_DAILY_LIMIT = 50;
const NEWS_RATE_KEY = "ratelimit:news";

export interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { name: string };
  urlToImage?: string | null;
  sentiment?: "positive" | "negative" | "neutral";
}

function mapFinnhubToNewsArticle(h: {
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  source: string;
  image: string;
}): NewsArticle {
  return {
    title: h.headline,
    description: h.summary || null,
    url: h.url,
    publishedAt: new Date(h.datetime * 1000).toISOString(),
    source: { name: h.source || "Finnhub" },
    urlToImage: h.image || null,
  };
}

export async function getTickerNews(
  ticker: string,
  companyName: string,
  pageSize = 5
): Promise<NewsArticle[]> {
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const cacheKey = `news:${ticker}:${from}`;

  const cached = await kv.get<NewsArticle[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  // Primary source: Finnhub company news (last 7 days, no daily key quota)
  try {
    const finnhubNews = await getFinnhubCompanyNews(ticker, pageSize);
    if (finnhubNews.length > 0) {
      const mapped = finnhubNews.map(mapFinnhubToNewsArticle);
      await kv.set(cacheKey, mapped, { ex: 3600 });
      return mapped;
    }
  } catch {
    // fall through to NewsAPI
  }

  if (!NEWS_API_KEY) return [];

  const { allowed } = await checkAndConsumeRateLimit(NEWS_RATE_KEY, NEWS_DAILY_LIMIT);
  if (!allowed) return [];

  const q = encodeURIComponent(`${ticker} OR "${companyName}" earnings`);

  try {
    const url = `${BASE}?q=${q}&from=${from}&sortBy=relevancy&pageSize=${pageSize}&language=es,en&apiKey=${NEWS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`NewsAPI error for ${ticker}:`, res.status, await res.text().catch(() => ""));
      return [];
    }

    const data = (await res.json()) as { articles?: NewsArticle[] };
    const articles = data.articles || [];

    if (articles.length > 0) {
      await kv.set(cacheKey, articles, { ex: 3600 });
    }
    return articles;
  } catch {
    return [];
  }
}

export async function getMarketNews(pageSize = 10): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];

  const { allowed } = await checkAndConsumeRateLimit(NEWS_RATE_KEY, NEWS_DAILY_LIMIT);
  if (!allowed) return [];

  const q = encodeURIComponent("S&P500 OR mercados OR Wall Street OR earnings");
  const url = `${BASE}?q=${q}&sortBy=publishedAt&pageSize=${pageSize}&language=es&apiKey=${NEWS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("NewsAPI market news error:", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = (await res.json()) as { articles?: NewsArticle[] };
  return data.articles || [];
}

export async function getNewsRemaining(): Promise<number> {
  const { remaining } = await checkAndConsumeRateLimit(NEWS_RATE_KEY, NEWS_DAILY_LIMIT);
  return remaining;
}
