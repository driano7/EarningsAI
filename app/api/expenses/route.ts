/*
 * Quartly Bot — route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

interface ExpenseData {
  items: Array<{ name: string; category: string; amount: number; pct: number }>;
  income: Array<{ name: string; amount: number }>;
  totalExpenses: number;
  totalIncome: number;
  updatedAt: string;
}

async function getData(chatId: string): Promise<ExpenseData> {
  const key = `expenses:${chatId}`;
  const data = await kv.get<ExpenseData>(key);
  return data || { items: [], income: [], totalExpenses: 0, totalIncome: 0, updatedAt: "" };
}

async function saveData(chatId: string, data: ExpenseData): Promise<void> {
  data.totalExpenses = data.items.reduce((s, i) => s + i.amount, 0);
  data.totalIncome = data.income.reduce((s, i) => s + i.amount, 0);
  data.updatedAt = new Date().toISOString();
  await kv.set(`expenses:${chatId}`, data);
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  const data = await getData(chatId);
  const categories: Record<string, { total: number; items: typeof data.items }> = {};
  for (const item of data.items) {
    if (!categories[item.category]) categories[item.category] = { total: 0, items: [] };
    categories[item.category].total += item.amount;
    categories[item.category].items.push(item);
  }

  return NextResponse.json({
    ok: true,
    ...data,
    categories: Object.entries(categories).map(([name, cat]) => ({
      name,
      total: cat.total,
      pct: data.totalExpenses > 0 ? (cat.total / data.totalExpenses) * 100 : 0,
      items: cat.items,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { chatId, type, name, category, amount } = await req.json();
  if (!chatId || !type || !name || !amount) {
    return NextResponse.json({ ok: false, error: "chatId, type, name, amount required" }, { status: 400 });
  }

  const data = await getData(chatId);
  if (type === "expense") {
    data.items.push({ name, category: category || "General", amount: Number(amount), pct: 0 });
  } else if (type === "income") {
    data.income.push({ name, amount: Number(amount) });
  }
  await saveData(chatId, data);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const { chatId, type, index, name, category, amount } = await req.json();
  if (!chatId || type === undefined || index === undefined) {
    return NextResponse.json({ ok: false, error: "chatId, type, index required" }, { status: 400 });
  }

  const data = await getData(chatId);
  if (type === "expense") {
    if (index < 0 || index >= data.items.length) return NextResponse.json({ ok: false, error: "Index out of range" }, { status: 400 });
    if (name !== undefined) data.items[index].name = name;
    if (category !== undefined) data.items[index].category = category;
    if (amount !== undefined) data.items[index].amount = Number(amount);
  } else if (type === "income") {
    if (index < 0 || index >= data.income.length) return NextResponse.json({ ok: false, error: "Index out of range" }, { status: 400 });
    if (name !== undefined) data.income[index].name = name;
    if (amount !== undefined) data.income[index].amount = Number(amount);
  }
  await saveData(chatId, data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { chatId, type, index } = await req.json();
  if (!chatId || type === undefined || index === undefined) {
    return NextResponse.json({ ok: false, error: "chatId, type, index required" }, { status: 400 });
  }

  const data = await getData(chatId);
  if (type === "expense") {
    if (index < 0 || index >= data.items.length) return NextResponse.json({ ok: false, error: "Index out of range" }, { status: 400 });
    data.items.splice(index, 1);
  } else if (type === "income") {
    if (index < 0 || index >= data.income.length) return NextResponse.json({ ok: false, error: "Index out of range" }, { status: 400 });
    data.income.splice(index, 1);
  }
  await saveData(chatId, data);
  return NextResponse.json({ ok: true });
}
