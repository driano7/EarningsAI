import { NextRequest, NextResponse } from "next/server";
import { getUserStocks, getUserEtfs, getUserCryptos, getCachedTickerData, setCachedTickerData } from "@/lib/kv";
import type { CachedTickerEarnings } from "@/lib/kv";
import { getEarningsHistory, getRecommendationTrends, getQuote } from "@/lib/finnhub";
import type { EarningEvent, RecommendationTrend, QuoteData } from "@/lib/finnhub";
import { getLogoUrl } from "@/lib/logo";
import { getCryptoDetails } from "@/lib/coingecko";

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

interface CryptoDetail {
  ticker: string;
  logo: string | null;
  priceUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCapUsd: number | null;
}

async function fetchStockDetail(ticker: string): Promise<StockDetail> {
  const cached = await getCachedTickerData(ticker);
  if (cached) {
    return {
      ticker,
      logo: cached.logo,
      earnings: cached.earnings as EarningEvent[],
      analystSignals: cached.analystSignals as RecommendationTrend[],
      quote: cached.quote as QuoteData | null,
    };
  }
  const [earnings, signals, quote, logo] = await Promise.all([
    getEarningsHistory(ticker),
    getRecommendationTrends(ticker),
    getQuote(ticker),
    getLogoUrl(ticker, false),
  ]);
  const detail: StockDetail = { ticker, logo, earnings, analystSignals: signals, quote };
  await setCachedTickerData(ticker, {
    logo,
    earnings: earnings as CachedTickerEarnings["earnings"],
    analystSignals: signals as CachedTickerEarnings["analystSignals"],
    quote: quote as CachedTickerEarnings["quote"],
  });
  return detail;
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  try {
    const [stockTickers, etfTickers, cryptoTickers] = await Promise.all([
      getUserStocks(chatId).catch(() => [] as string[]),
      getUserEtfs(chatId).catch(() => [] as string[]),
      getUserCryptos(chatId).catch(() => [] as string[]),
    ]);

    const [stockDetails, etfDetails, cryptoDetails] = await Promise.all([
      Promise.allSettled(stockTickers.map(fetchStockDetail)),
      Promise.allSettled(
        etfTickers.map(async (ticker) => {
          const [quote, logo] = await Promise.all([
            getQuote(ticker),
            getLogoUrl(ticker, true),
          ]);
          return { ticker, logo, quote } satisfies EtfDetail;
        })
      ),
      Promise.allSettled(
        cryptoTickers.map(async (ticker) => {
          const details = await getCryptoDetails(ticker);
          return {
            ticker,
            logo: details?.logo ?? null,
            priceUsd: details?.priceUsd ?? null,
            change24h: details?.change24h ?? null,
            change7d: details?.change7d ?? null,
            marketCapUsd: details?.marketCapUsd ?? null,
          } satisfies CryptoDetail;
        })
      ),
    ]);

    const stocks: StockDetail[] = stockDetails
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<StockDetail>).value);

    const etfs: EtfDetail[] = etfDetails
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<EtfDetail>).value);

    const cryptos: CryptoDetail[] = cryptoDetails
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<CryptoDetail>).value);

    return NextResponse.json({ ok: true, stocks, etfs, cryptos });
  } catch (err) {
    console.error("[favorites/details API] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
