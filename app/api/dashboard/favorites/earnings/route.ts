import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getUserStocks, getUserEtfs } from "@/lib/kv";
import { getEarningsHistory, getRecommendationTrends, getQuote } from "@/lib/finnhub";
import type { EarningEvent, RecommendationTrend, QuoteData } from "@/lib/finnhub";
import { getLogoUrl } from "@/lib/logo";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface StockDetail {
  ticker: string;
  logo: string | null;
  earnings: EarningEvent[];
  analystSignals: RecommendationTrend[];
  quote: QuoteData | null;
}

interface EtfDetail {
  ticker: string;
  logo: string | null;
  quote: QuoteData | null;
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  try {
    const cacheKey = `fav:detail:${chatId}`;
    const cached = await kv.get<{ data: { stocks: StockDetail[]; etfs: EtfDetail[] }; cachedAt: number }>(cacheKey);

    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, ...cached.data, cached: true, cachedAt: new Date(cached.cachedAt).toISOString() });
    }

    const [stockTickers, etfTickers] = await Promise.all([
      getUserStocks(chatId).catch(() => [] as string[]),
      getUserEtfs(chatId).catch(() => [] as string[]),
    ]);

    const [stockDetails, etfDetails] = await Promise.all([
      Promise.allSettled(
        stockTickers.map(async (ticker) => {
          const [earnings, signals, quote, logo] = await Promise.all([
            getEarningsHistory(ticker),
            getRecommendationTrends(ticker),
            getQuote(ticker),
            getLogoUrl(ticker, false),
          ]);
          return { ticker, logo, earnings, analystSignals: signals, quote } satisfies StockDetail;
        })
      ),
      Promise.allSettled(
        etfTickers.map(async (ticker) => {
          const [quote, logo] = await Promise.all([
            getQuote(ticker),
            getLogoUrl(ticker, true),
          ]);
          return { ticker, logo, quote } satisfies EtfDetail;
        })
      ),
    ]);

    const stocks: StockDetail[] = stockDetails
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<StockDetail>).value);

    const etfs: EtfDetail[] = etfDetails
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<EtfDetail>).value);

    const now = Date.now();
    await kv.set(cacheKey, { data: { stocks, etfs }, cachedAt: now });
    await kv.expire(cacheKey, 86400);

    return NextResponse.json({ ok: true, stocks, etfs, cached: false, cachedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("[favorites/earnings API] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
