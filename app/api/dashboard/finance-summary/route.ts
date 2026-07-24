/*
 * Quartly Bot — app/api/dashboard/finance-summary/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

interface FinanceTxn {
  id: string;
  type: "income" | "expense" | "invest";
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: number;
}

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const txns = await kv.get<FinanceTxn[]>(`finance:${chatId}:transactions`);
  if (!txns || txns.length === 0) {
    return NextResponse.json({ ok: true, monthly: [], totalIncome: 0, totalExpense: 0 });
  }

  const monthlyMap: Record<string, { income: number; expense: number }> = {};

  for (const t of txns) {
    const month = t.date.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { income: 0, expense: 0 };
    if (t.type === "income") monthlyMap[month].income += t.amount;
    else if (t.type === "expense") monthlyMap[month].expense += t.amount;
  }

  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({ month, ...vals }));

  const totalIncome = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({ ok: true, monthly, totalIncome, totalExpense });
}
