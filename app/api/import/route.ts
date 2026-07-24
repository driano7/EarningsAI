/*
 * Quartly Bot — route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextResponse } from "next/server";
import { addStock, addEtf, addCrypto, registerUser } from "@/lib/kv";
import { addPosition } from "@/lib/kv-portfolio";
import type { PortfolioPosition } from "@/lib/types";
import { kv } from "@vercel/kv";

async function clearPositions(chatId: string) {
  await kv.set(`portfolio:${chatId}`, []);
}

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
  ticker: string; type: "sofipo" | "cetes" | "crypto"; amount: number;
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
  { ticker: "BTC.T", type: "crypto", amount: 6875 },
  { ticker: "ETH.T", type: "crypto", amount: 762 },
  { ticker: "BINANCE", type: "crypto", amount: 2700 },
  { ticker: "BITSO", type: "crypto", amount: 1560 },
  { ticker: "BTC.B", type: "crypto", amount: 19563 },
  { ticker: "BTC.B2", type: "crypto", amount: 4096 },
];

interface ExpenseItem {
  name: string;
  category: string;
  amount: number;
  pct: number;
}

const EXPENSES: ExpenseItem[] = [
  { name: "Renta", category: "Vivienda", amount: 3600, pct: 11.25 },
  { name: "Agua", category: "Vivienda", amount: 45, pct: 0.14 },
  { name: "Luz", category: "Vivienda", amount: 65, pct: 0.20 },
  { name: "Internet", category: "Vivienda", amount: 190, pct: 0.59 },
  { name: "Gas", category: "Vivienda", amount: 230, pct: 0.72 },
  { name: "Plan Telcel", category: "Entretenimiento", amount: 230, pct: 0.72 },
  { name: "Merced", category: "Comida", amount: 1800, pct: 5.63 },
  { name: "Chedraui", category: "Comida", amount: 1900, pct: 5.94 },
  { name: "Alberca", category: "Entretenimiento", amount: 200, pct: 0.63 },
  { name: "Spotify", category: "Entretenimiento", amount: 85, pct: 0.27 },
  { name: "Tratamiento", category: "Comida", amount: 600, pct: 1.88 },
  { name: "Pisto y pan", category: "Entretenimiento", amount: 1300, pct: 4.06 },
  { name: "Corte cabello", category: "Comida", amount: 60, pct: 0.19 },
  { name: "Garrafón", category: "Comida", amount: 110, pct: 0.34 },
  { name: "Pechuga", category: "Comida", amount: 240, pct: 0.75 },
  { name: "Variables", category: "Entretenimiento", amount: 1000, pct: 3.13 },
  { name: "Tortillas/basura", category: "Comida", amount: 60, pct: 0.19 },
  { name: "Bruno", category: "Comida", amount: 450, pct: 1.41 },
];

const INCOME_ITEMS = [
  { name: "Amex", amount: 19500 },
  { name: "Vales", amount: 4000 },
  { name: "Inversión", amount: 1000 },
  { name: "Bonos", amount: 7500 },
];

export async function GET() {
  const results: string[] = [];

  await registerUser(CHAT_ID);

  /* Clear stale ticker cache so sparklines re-fetch fresh */
  const cachedKeys = await kv.keys("ticker:data:*");
  for (const k of cachedKeys) await kv.del(k);
  results.push(`cleared ${cachedKeys.length} cached ticker entries ✅`);

  for (const t of STOCKS) results.push(`stock ${t} ${(await addStock(CHAT_ID, t)).ok ? "✅" : "❌"}`);
  for (const t of ETFS) results.push(`etf ${t} ${(await addEtf(CHAT_ID, t)).ok ? "✅" : "❌"}`);
  for (const t of CRYPTOS) results.push(`crypto ${t} ${(await addCrypto(CHAT_ID, t)).ok ? "✅" : "❌"}`);

  /* Clear existing positions to avoid duplicates from repeated imports */
  await clearPositions(CHAT_ID);
  results.push("cleared existing positions ✅");

  for (const p of POSITIONS) {
    const pos: PortfolioPosition = {
      id: crypto.randomUUID(),
      chatId: CHAT_ID,
      ticker: p.ticker,
      type: p.type,
      buyPrice: p.amount,
      quantity: 1,
      buyDate: "2026-01-01",
      notes: p.type === "sofipo" ? "SOFIPO" : p.type === "cetes" ? "CETES" : "Crypto",
      createdAt: new Date().toISOString(),
    };
    await addPosition(CHAT_ID, pos);
    results.push(`position ${p.ticker} (${p.type}) = $${p.amount} ✅`);
  }

  const expenseKey = `expenses:${CHAT_ID}`;
  await kv.set(expenseKey, {
    items: EXPENSES,
    income: INCOME_ITEMS,
    totalExpenses: EXPENSES.reduce((s, e) => s + e.amount, 0),
    totalIncome: INCOME_ITEMS.reduce((s, e) => s + e.amount, 0),
    updatedAt: new Date().toISOString(),
  });
  results.push(`expenses stored: ${EXPENSES.length} items ✅`);
  results.push(`income stored: ${INCOME_ITEMS.length} items ✅`);

  /* Sync CSV expenses → finance transactions for Finanzas page (clear first) */
  const finKey = `finance:${CHAT_ID}:transactions`;
  const finTxns = [];
  const monthDates = ["2026-04-28", "2026-04-15", "2026-03-28", "2026-03-15", "2026-03-05", "2026-02-28", "2026-02-15", "2026-02-05", "2026-01-28", "2026-01-15", "2026-01-05", "2025-12-28", "2025-12-15", "2025-12-05", "2025-11-28", "2025-11-15", "2025-11-05", "2025-10-28"];
  for (let i = 0; i < EXPENSES.length; i++) {
    const exp = EXPENSES[i];
    const date = monthDates[i % monthDates.length];
    finTxns.push({
      id: crypto.randomUUID(),
      type: "expense",
      amount: exp.amount,
      category: exp.category,
      description: exp.name,
      date,
      createdAt: Date.now(),
    });
  }
  for (let i = 0; i < INCOME_ITEMS.length; i++) {
    const inc = INCOME_ITEMS[i];
    const date = monthDates[(EXPENSES.length + i) % monthDates.length];
    finTxns.push({
      id: crypto.randomUUID(),
      type: "income",
      amount: inc.amount,
      category: "Ingreso",
      description: inc.name,
      date,
      createdAt: Date.now(),
    });
  }
  await kv.set(finKey, finTxns);
  results.push(`finance transactions synced: ${finTxns.length} ✅`);

  return NextResponse.json({ ok: true, count: results.length, results });
}
