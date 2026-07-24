/*
 * Quartly Bot — app/api/dashboard/portfolio/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getPositions, addPosition, updatePosition, deletePosition } from "@/lib/kv-portfolio";
import type { PortfolioPosition } from "@/lib/types";

function getChatId(req: NextRequest): string | null {
  const chatId = req.nextUrl.searchParams.get("chatId");
  return chatId;
}

export async function GET(req: NextRequest) {
  const chatId = getChatId(req);
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }
  let positions = await getPositions(chatId);

  const seen = new Map<string, PortfolioPosition>();
  for (const pos of positions) {
    const key = `${pos.ticker}:${pos.type}:${pos.buyPrice}`;
    if (!seen.has(key)) {
      seen.set(key, pos);
    }
  }
  positions = Array.from(seen.values());

  if (positions.length !== (await getPositions(chatId)).length) {
    await kv.set(`portfolio:${chatId}`, positions);
  }

  return NextResponse.json({ ok: true, positions });
}

export async function POST(req: NextRequest) {
  const chatId = getChatId(req);
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }
  const body = await req.json();
  if (!body.ticker || !body.buyPrice || !body.quantity || !body.buyDate) {
    return NextResponse.json({ ok: false, error: "ticker, buyPrice, quantity, buyDate required" }, { status: 400 });
  }

  const position: PortfolioPosition = {
    id: crypto.randomUUID(),
    chatId,
    ticker: body.ticker.toUpperCase(),
    type: body.type || "stock",
    buyPrice: Number(body.buyPrice),
    quantity: Number(body.quantity),
    buyDate: body.buyDate,
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };

  await addPosition(chatId, position);
  return NextResponse.json({ ok: true, position });
}

export async function PUT(req: NextRequest) {
  const chatId = getChatId(req);
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const updates: Partial<PortfolioPosition> = {};
  if (body.ticker) updates.ticker = body.ticker.toUpperCase();
  if (body.type) updates.type = body.type;
  if (body.buyPrice) updates.buyPrice = Number(body.buyPrice);
  if (body.quantity) updates.quantity = Number(body.quantity);
  if (body.buyDate) updates.buyDate = body.buyDate;
  if (body.notes !== undefined) updates.notes = body.notes;

  const ok = await updatePosition(chatId, body.id, updates);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Position not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const chatId = getChatId(req);
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const ok = await deletePosition(chatId, body.id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Position not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
