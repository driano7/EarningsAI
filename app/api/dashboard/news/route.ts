import { NextRequest, NextResponse } from "next/server";
import { getUserStocks, getUserEtfs, getUserCryptos } from "@/lib/kv";
import { SP500 } from "@/lib/sp500";
import { ETFS } from "@/lib/etfs";
import { getTickerNews, getMarketNews } from "@/lib/news";
import { getFinnhubGeneralNews, getFinnhubCompanyNews } from "@/lib/finnhub";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  const source = req.nextUrl.searchParams.get("source") || "newsapi";
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const ticker = req.nextUrl.searchParams.get("ticker");

  if (ticker) {
    const [stocks, etfs, cryptos] = await Promise.all([
      getUserStocks(chatId).catch(() => [] as string[]),
      getUserEtfs(chatId).catch(() => [] as string[]),
      getUserCryptos(chatId).catch(() => [] as string[]),
    ]);
    const userTickers = new Set([...stocks, ...etfs, ...cryptos]);
    if (!userTickers.has(ticker)) {
      return NextResponse.json({ ok: false, error: "Ticker not in user watchlist" }, { status: 400 });
    }

    if (source === "finnhub") {
      const articles = await getFinnhubCompanyNews(ticker);
      return NextResponse.json({ ok: true, articles, source: "finnhub" });
    }

    const sp = SP500.find((c) => c.ticker === ticker);
    const etf = ETFS.find((e) => e.ticker === ticker);
    const companyName = sp?.name || etf?.name || ticker;

    const articles = await getTickerNews(ticker, companyName);
    return NextResponse.json({ ok: true, articles, source: "newsapi" });
  }

  if (source === "finnhub") {
    const articles = await getFinnhubGeneralNews();
    return NextResponse.json({ ok: true, articles, source: "finnhub" });
  }

  const articles = await getMarketNews();
  return NextResponse.json({ ok: true, articles, source: "newsapi" });
}
