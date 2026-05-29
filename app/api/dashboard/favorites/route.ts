import { NextRequest, NextResponse } from "next/server";
import {
  getUserStocks,
  getUserEtfs,
  getUserCryptos,
  addStock,
  addEtf,
  addCrypto,
  removeStock,
  removeEtf,
  removeCrypto,
} from "@/lib/kv";
import { getCryptoQuote, CRYPTO_ID_MAP } from "@/lib/coingecko";
import { SP500 } from "@/lib/sp500";
import { ETFS } from "@/lib/etfs";
import { CUSTOM_TICKERS } from "@/lib/custom-tickers";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const [stocks, etfs, cryptos] = await Promise.all([
    getUserStocks(chatId),
    getUserEtfs(chatId),
    getUserCryptos(chatId),
  ]);

  const stockData = stocks.map((ticker) => {
    const sp = SP500.find((c) => c.ticker === ticker);
    const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
    return { ticker, name: sp?.name || custom?.name || ticker, sector: sp?.sector || custom?.sector || "", type: "stock" as const };
  });

  const etfData = etfs.map((ticker) => {
    const etf = ETFS.find((e) => e.ticker === ticker);
    return { ticker, name: etf?.name || ticker, sector: etf?.category || "", type: "etf" as const };
  });

  const cryptoQuotes = await Promise.all(
    cryptos.map(async (ticker) => {
      const quote = await getCryptoQuote(ticker);
      const name = CRYPTO_ID_MAP[ticker]
        ? CRYPTO_ID_MAP[ticker].charAt(0).toUpperCase() + CRYPTO_ID_MAP[ticker].slice(1)
        : ticker;
      return { ticker, name, priceUsd: quote?.priceUsd ?? null, change24h: quote?.change24h ?? null, type: "crypto" as const };
    })
  );

  return NextResponse.json({ ok: true, stocks: stockData, etfs: etfData, cryptos: cryptoQuotes });
}

export async function POST(req: NextRequest) {
  const { chatId, ticker, type } = await req.json();
  if (!chatId || !ticker || !type) {
    return NextResponse.json({ ok: false, error: "chatId, ticker, type required" }, { status: 400 });
  }

  let result: { ok: boolean; error?: string };
  if (type === "crypto") {
    result = await addCrypto(chatId, ticker.toUpperCase());
  } else if (type === "etf") {
    result = await addEtf(chatId, ticker.toUpperCase());
  } else {
    result = await addStock(chatId, ticker.toUpperCase());
  }

  return NextResponse.json({ ok: result.ok, error: result.error });
}

export async function DELETE(req: NextRequest) {
  const { chatId, ticker, type } = await req.json();
  if (!chatId || !ticker || !type) {
    return NextResponse.json({ ok: false, error: "chatId, ticker, type required" }, { status: 400 });
  }

  if (type === "crypto") {
    await removeCrypto(chatId, ticker.toUpperCase());
  } else if (type === "etf") {
    await removeEtf(chatId, ticker.toUpperCase());
  } else {
    await removeStock(chatId, ticker.toUpperCase());
  }

  return NextResponse.json({ ok: true });
}
