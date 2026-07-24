/*
 * Quartly Bot — lib/yahoo-finance-news.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import yahooFinance from "yahoo-finance2";

export interface YahooNewsItem {
  ticker: string;
  title: string;
  publisher: string;
  summary: string;
  link: string;
  pubDate: string;
}

export async function getYahooTickerNews(tickers: string[], maxPerTicker = 2): Promise<YahooNewsItem[]> {
  const results: YahooNewsItem[] = [];

  for (const ticker of tickers.slice(0, 10)) {
    try {
      const yfTicker = yahooFinance.Ticker(ticker);
      const news = await yfTicker.getNews();

      if (Array.isArray(news)) {
        for (const item of news.slice(0, maxPerTicker)) {
          const content = item as Record<string, unknown>;
          const inner = (content.content || content) as Record<string, unknown>;
          const title = (inner.title as string) || "";
          const summary = ((inner.summary as string) || "").slice(0, 200);
          const pubDate = (inner.pubDate as string) || "";
          const provider = (inner.provider as Record<string, unknown>) || {};
          const publisher = (provider.displayName as string) || "";
          const canonical = (inner.canonicalUrl as Record<string, unknown>) || {};
          const link = (canonical.url as string) || "";

          if (title) {
            results.push({ ticker, title, publisher, summary, link, pubDate });
          }
        }
      }
    } catch {
      // Skip ticker on error
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}

export function formatYahooNewsForPrompt(news: YahooNewsItem[]): string {
  if (news.length === 0) return "No hay noticias especificas de Yahoo Finance";
  return news
    .map((n) => `- [${n.ticker}/${n.publisher}] ${n.title}. ${n.summary}`)
    .join("\n");
}
