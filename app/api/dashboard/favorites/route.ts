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
  getAllUsers,
} from "@/lib/kv";
import { getCryptoQuote, CRYPTO_ID_MAP } from "@/lib/coingecko";
import { SP500 } from "@/lib/sp500";
import { ETFS } from "@/lib/etfs";
import { CUSTOM_TICKERS } from "@/lib/custom-tickers";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  const exploreAll = req.nextUrl.searchParams.get("all") === "true";

  if (!chatId && !exploreAll) {
    return NextResponse.json({ ok: false, error: "chatId required or ?all=true" }, { status: 400 });
  }

  try {
    const allUsers = await getAllUsers().catch(() => [] as string[]);

    if (exploreAll) {
      const allData: Record<string, { stocks: string[]; etfs: string[]; cryptos: string[] }> = {};
      for (const uid of allUsers) {
        const [stocks, etfs, cryptos] = await Promise.all([
          getUserStocks(uid).catch(() => [] as string[]),
          getUserEtfs(uid).catch(() => [] as string[]),
          getUserCryptos(uid).catch(() => [] as string[]),
        ]);
        if (stocks.length > 0 || etfs.length > 0 || cryptos.length > 0) {
          allData[uid] = { stocks, etfs, cryptos };
        }
      }
      return NextResponse.json({ ok: true, allUsers, data: allData, mode: "explore" });
    }

    const uid = chatId!;
    const [stocks, etfs, cryptos] = await Promise.all([
      getUserStocks(uid).catch(() => [] as string[]),
      getUserEtfs(uid).catch(() => [] as string[]),
      getUserCryptos(uid).catch(() => [] as string[]),
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

    const cryptoResults = await Promise.allSettled(
      cryptos.map(async (ticker) => {
        try {
          const quote = await getCryptoQuote(ticker);
          const name = CRYPTO_ID_MAP[ticker]
            ? CRYPTO_ID_MAP[ticker].charAt(0).toUpperCase() + CRYPTO_ID_MAP[ticker].slice(1)
            : ticker;
          return { ticker, name, priceUsd: quote?.priceUsd ?? null, change24h: quote?.change24h ?? null, type: "crypto" as const };
        } catch {
          return { ticker, name: ticker, priceUsd: null, change24h: null, type: "crypto" as const };
        }
      })
    );
    const cryptoData = cryptoResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    return NextResponse.json({
      ok: true,
      stocks: stockData,
      etfs: etfData,
      cryptos: cryptoData,
      debug: { chatId, allUsers, keysFound: { stocks: stocks.length, etfs: etfs.length, cryptos: cryptos.length } },
    });
  } catch (err) {
    console.error("[favorites API] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
  } catch (err) {
    console.error("[favorites POST] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
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
  } catch (err) {
    console.error("[favorites DELETE] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
