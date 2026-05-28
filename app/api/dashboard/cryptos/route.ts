import { NextRequest, NextResponse } from "next/server";
import { getUserCryptos } from "@/lib/kv";
import { getCryptoQuote } from "@/lib/coingecko";
import { CRYPTO_ID_MAP } from "@/lib/coingecko";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const tickers = await getUserCryptos(chatId);
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const quote = await getCryptoQuote(ticker);
      const name = CRYPTO_ID_MAP[ticker]
        ? CRYPTO_ID_MAP[ticker].charAt(0).toUpperCase() + CRYPTO_ID_MAP[ticker].slice(1)
        : ticker;
      return {
        ticker,
        name,
        priceUsd: quote?.priceUsd ?? null,
        change24h: quote?.change24h ?? null,
        change7d: quote?.change7d ?? null,
        marketCapUsd: quote?.marketCapUsd ?? null,
      };
    })
  );

  return NextResponse.json({ ok: true, cryptos: results });
}
