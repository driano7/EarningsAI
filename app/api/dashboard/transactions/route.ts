/*
 * Quartly Bot — app/api/dashboard/transactions/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTransactions, addTransaction } from "@/lib/kv-portfolio";
import type { Transaction } from "@/lib/types";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }
  const txns = await getTransactions(chatId);
  return NextResponse.json({ ok: true, transactions: txns });
}

export async function POST(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }
  const body = await req.json();
  if (!body.ticker || body.price === undefined || !body.quantity || !body.date || !body.type) {
    return NextResponse.json({ ok: false, error: "ticker, price, quantity, date, type required" }, { status: 400 });
  }

  const txn: Transaction = {
    id: crypto.randomUUID(),
    chatId,
    ticker: body.ticker.toUpperCase(),
    type: body.type,
    price: Number(body.price),
    quantity: Number(body.quantity),
    date: body.date,
    notes: body.notes || "",
  };

  await addTransaction(chatId, txn);
  return NextResponse.json({ ok: true, transaction: txn });
}
