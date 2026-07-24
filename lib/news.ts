import { kv } from "@vercel/kv";
import { checkAndConsumeRateLimit } from "./api-ratelimit";

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

export async function getTickerNews(
  ticker: string,
  companyName: string,
  pageSize = 5
): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];

  const { allowed } = await checkAndConsumeRateLimit(NEWS_RATE_KEY, NEWS_DAILY_LIMIT);
  if (!allowed) return [];

  const q = encodeURIComponent(`${ticker} OR "${companyName}" earnings`);
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const cacheKey = `news:${ticker}:${from}`;

  const cached = await kv.get<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  const url = `${BASE}?q=${q}&from=${from}&sortBy=relevancy&pageSize=${pageSize}&language=es,en&apiKey=${NEWS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { articles?: NewsArticle[] };
  const articles: NewsArticle[] = data.articles || [];

  await kv.set(cacheKey, articles, { ex: 3600 });
  return articles;
}

export async function getMarketNews(pageSize = 10): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];

  const { allowed } = await checkAndConsumeRateLimit(NEWS_RATE_KEY, NEWS_DAILY_LIMIT);
  if (!allowed) return [];

  const q = encodeURIComponent("S&P500 OR mercados OR Wall Street OR earnings");
  const url = `${BASE}?q=${q}&sortBy=publishedAt&pageSize=${pageSize}&language=es&apiKey=${NEWS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { articles?: NewsArticle[] };
  return data.articles || [];
}

export async function getNewsRemaining(): Promise<number> {
  const { remaining } = await checkAndConsumeRateLimit(NEWS_RATE_KEY, NEWS_DAILY_LIMIT);
  return remaining;
}
