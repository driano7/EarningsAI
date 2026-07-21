import { kv } from "@vercel/kv";

const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const BASE = "https://newsapi.org/v2/everything";

export interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { name: string };
  sentiment?: "positive" | "negative" | "neutral";
}

export async function getTickerNews(
  ticker: string,
  companyName: string,
  pageSize = 5
): Promise<NewsArticle[]> {
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
  const q = encodeURIComponent("S&P500 OR mercados OR Wall Street OR earnings");
  const url = `${BASE}?q=${q}&sortBy=publishedAt&pageSize=${pageSize}&language=es&apiKey=${NEWS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { articles?: NewsArticle[] };
  return data.articles || [];
}
