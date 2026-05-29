import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const expenseKey = `expenses:${chatId}`;
  const data = await kv.get<{
    items: Array<{ name: string; category: string; amount: number; pct: number }>;
    income: Array<{ name: string; amount: number }>;
    totalExpenses: number;
    totalIncome: number;
    updatedAt: string;
  }>(expenseKey);

  if (!data) {
    return NextResponse.json({ ok: false, error: "No expense data found. Run /api/import first." });
  }

  const categories = data.items.reduce<Record<string, { total: number; items: typeof data.items }>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = { total: 0, items: [] };
    acc[item.category].total += item.amount;
    acc[item.category].items.push(item);
    return acc;
  }, {});

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
