import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const period = searchParams.get("period") || "1m";

  if (!ticker) {
    return NextResponse.json({ ok: false, error: "Missing ticker" }, { status: 400 });
  }

  const now = new Date();
  const period1 = new Date();
  if (period === "1w") period1.setDate(now.getDate() - 7);
  else if (period === "1m") period1.setMonth(now.getMonth() - 1);
  else if (period === "3m") period1.setMonth(now.getMonth() - 3);
  else if (period === "1y") period1.setFullYear(now.getFullYear() - 1);
  else period1.setMonth(now.getMonth() - 1);

  try {
    const historical = await yahooFinance.historical(ticker, {
      period1,
      period2: now,
      interval: "1d",
    }) as Array<{ date: Date; close: number }>;

    const prices = historical
      .filter((d) => d.close != null)
      .map((d) => ({
        date: d.date.toISOString().slice(0, 10),
        close: d.close,
      }));

    return NextResponse.json({ ok: true, ticker, prices });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to fetch history" }, { status: 500 });
  }
}
