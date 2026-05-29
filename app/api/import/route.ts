import { NextResponse } from "next/server";
import { addStock, addEtf, addCrypto, registerUser } from "@/lib/kv";
import { addPosition } from "@/lib/kv-portfolio";
import type { PortfolioPosition } from "@/lib/types";

const CHAT_ID = "1057816434";

const STOCKS = [
  "AMZN","BRK.B","SAP","AVGO","TSLA","IBM","META","AXP","WMT","ORCL",
  "CRM","MSFT","GS","PLTR","HOOD","CSCO","PANW","COIN","NET","ASML",
  "V","MSTR","MA","CRWD",
];

const ETFS = [
  "ESPO","ICOP","SLV","IWM","JETS","GLDM","AAAU","IUIT","IUES","MEX",
];

const CRYPTOS = ["BTC","ETH"];

const POSITIONS: Array<{
  ticker: string; type: "sofipo" | "cetes"; amount: number;
}> = [
  { ticker: "OPEN", type: "sofipo", amount: 58534 },
  { ticker: "REVO", type: "sofipo", amount: 25147 },
  { ticker: "NU", type: "sofipo", amount: 24357 },
  { ticker: "MERCADO PAGO", type: "sofipo", amount: 24654 },
  { ticker: "KLAR", type: "sofipo", amount: 1284 },
  { ticker: "DIDI", type: "sofipo", amount: 10514 },
  { ticker: "FONDE", type: "sofipo", amount: 5272 },
  { ticker: "FINSUS", type: "sofipo", amount: 514 },
  { ticker: "CETES28", type: "cetes", amount: 14025 },
  { ticker: "BTC.T", type: "sofipo", amount: 6875 },
  { ticker: "ETH.T", type: "sofipo", amount: 762 },
  { ticker: "BINANCE", type: "sofipo", amount: 2700 },
  { ticker: "BITSO", type: "sofipo", amount: 1560 },
  { ticker: "BTC.B", type: "sofipo", amount: 19563 },
  { ticker: "BTC.B2", type: "sofipo", amount: 4096 },
];

export async function GET() {
  const results: string[] = [];

  await registerUser(CHAT_ID);

  for (const t of STOCKS) {
    const r = await addStock(CHAT_ID, t);
    results.push(r.ok ? `stock ${t} ✅` : `stock ${t} ❌ ${r.error}`);
  }

  for (const t of ETFS) {
    const r = await addEtf(CHAT_ID, t);
    results.push(r.ok ? `etf ${t} ✅` : `etf ${t} ❌ ${r.error}`);
  }

  for (const t of CRYPTOS) {
    const r = await addCrypto(CHAT_ID, t);
    results.push(r.ok ? `crypto ${t} ✅` : `crypto ${t} ❌ ${r.error}`);
  }

  for (const p of POSITIONS) {
    const pos: PortfolioPosition = {
      id: crypto.randomUUID(),
      chatId: CHAT_ID,
      ticker: p.ticker,
      type: p.type,
      buyPrice: p.amount,
      quantity: 1,
      buyDate: "2026-01-01",
      notes: p.type === "sofipo" ? "SOFIPO" : "CETES",
      createdAt: new Date().toISOString(),
    };
    await addPosition(CHAT_ID, pos);
    results.push(`position ${p.ticker} (${p.type}) = $${p.amount} ✅`);
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
