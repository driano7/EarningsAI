import { NextRequest, NextResponse } from "next/server";
import { getUserStocks, getUserEtfs } from "@/lib/kv";
import { SP500 } from "@/lib/sp500";
import { ETFS } from "@/lib/etfs";
import { getTickerNews, getMarketNews } from "@/lib/news";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const ticker = req.nextUrl.searchParams.get("ticker");

  if (ticker) {
    const [stocks, etfs] = await Promise.all([
      getUserStocks(chatId).catch(() => [] as string[]),
      getUserEtfs(chatId).catch(() => [] as string[]),
    ]);
    const userTickers = new Set([...stocks, ...etfs]);
    if (!userTickers.has(ticker)) {
      return NextResponse.json({ ok: false, error: "Ticker not in user watchlist" }, { status: 400 });
    }

    const sp = SP500.find((c) => c.ticker === ticker);
    const etf = ETFS.find((e) => e.ticker === ticker);
    const companyName = sp?.name || etf?.name || ticker;

    const articles = await getTickerNews(ticker, companyName);
    return NextResponse.json({ ok: true, articles });
  }

  const articles = await getMarketNews();
  return NextResponse.json({ ok: true, articles });
}
