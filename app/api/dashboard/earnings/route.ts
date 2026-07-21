import { NextRequest, NextResponse } from "next/server";
import { getUserWatchlist } from "@/lib/kv";
import { getEarningsCalendar } from "@/lib/finnhub";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ ok: false, error: "from and to query params required (YYYY-MM-DD)" }, { status: 400 });
  }

  const { stocks, etfs } = await getUserWatchlist(chatId);
  const watchlist = new Set([...stocks, ...etfs]);

  const calendar = await getEarningsCalendar(from, to);
  const filtered = calendar
    .filter((e) => watchlist.has(e.symbol))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ ok: true, events: filtered });
}
