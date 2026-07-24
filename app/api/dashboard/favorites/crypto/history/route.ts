import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
  }

  const cacheKey = `crypto:history:${ticker}`;
  const cached = await kv.get<Array<{ date: string; value: number }>>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, data: cached });
  }

  const CRYPTO_ID_MAP: Record<string, string> = {
    BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano",
    DOT: "polkadot", AVAX: "avalanche-2", MATIC: "matic-network",
    LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos",
    XRP: "ripple", BNB: "binancecoin", DOGE: "dogecoin", LTC: "litecoin",
    TRX: "tron", NEAR: "near", APT: "aptos", ARB: "arbitrum",
    OP: "optimism", SUI: "sui", INJ: "injective-protocol",
    TIA: "celestia", SEI: "sei-network", FET: "fetch-ai",
    RNDR: "render-token", FIL: "filecoin", ICP: "internet-computer",
    HBAR: "hedera-hashgraph", VET: "vechain", ALGO: "algorand",
    FTM: "fantom", EOS: "eos", ZIL: "zilliqa",
    THETA: "theta-token", GRT: "the-graph", ENJ: "enjincoin",
    SAND: "the-sandbox", MANA: "decentraland", AXS: "axie-infinity",
    AAVE: "aave", MKR: "maker", COMP: "compound-governance-token",
    YFI: "yearn-finance", SNX: "havven", SUSHI: "sushi",
    CRV: "curve-dao-token", BAL: "balancer", CAKE: "pancakeswap-token",
    RUNE: "thorchain",
  };

  const coinId = CRYPTO_ID_MAP[ticker.toUpperCase()];
  if (!coinId) {
    return NextResponse.json({ ok: false, error: `Unknown crypto: ${ticker}` }, { status: 400 });
  }

  try {
    const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=30`;
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `CoinGecko API error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    if (!data.prices || !Array.isArray(data.prices)) {
      return NextResponse.json({ ok: false, error: "No price data" }, { status: 404 });
    }

    const result = data.prices.map(([timestamp, price]: [number, number]) => ({
      date: new Date(timestamp).toISOString().split("T")[0],
      value: price,
    }));

    await kv.set(cacheKey, result, { ex: 3600 });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
