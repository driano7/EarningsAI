/*
 * Quartly Bot — app/api/dashboard/ai/portfolio/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getPositions } from "@/lib/kv-portfolio";
import { getQuote } from "@/lib/finnhub";
import { analyzePortfolioWithAI } from "@/lib/ai-analysis";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const cacheKey = `ai:portfolio:${chatId}`;
  const cached = await kv.get(cacheKey);
  if (cached) return NextResponse.json({ ok: true, insight: cached });

  const positions = await getPositions(chatId);
  if (positions.length === 0) {
    return NextResponse.json({ ok: false, error: "No portfolio positions" }, { status: 404 });
  }

  const enriched = await Promise.all(
    positions.map(async (p) => {
      const quote = await getQuote(p.ticker).catch(() => null);
      return {
        ticker: p.ticker,
        type: p.type,
        buyPrice: p.buyPrice,
        currentPrice: quote?.c ?? undefined,
        quantity: p.quantity,
      };
    })
  );

  const insight = await analyzePortfolioWithAI(enriched);

  if (insight === null) {
    return NextResponse.json({ ok: false, error: "quota_exceeded" });
  }

  await kv.set(cacheKey, insight, { ex: 7200 });
  return NextResponse.json({ ok: true, insight });
}
