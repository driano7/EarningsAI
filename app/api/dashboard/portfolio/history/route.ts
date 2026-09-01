/*
 * Quartly Bot — app/api/dashboard/portfolio/history/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getMovements,
  addMovement,
  deleteMovement,
  updateMovement,
  filterByPeriod,
  computeMonthlySnapshots,
  computeSummary,
  type PortfolioMovement,
  type MovementType,
} from "@/lib/portfolio-history";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const period = req.nextUrl.searchParams.get("period") || "all";
  const movements = await getMovements(chatId);
  const filtered = filterByPeriod(movements, period);
  const snapshots = computeMonthlySnapshots(filtered);
  const summary = computeSummary(filtered);

  return NextResponse.json({ ok: true, movements: filtered, snapshots, summary });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const chatId = body.chatId;
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  if (!body.type || !body.ticker || !body.amount || !body.date) {
    return NextResponse.json({ ok: false, error: "type, ticker, amount, date required" }, { status: 400 });
  }

  const movement: PortfolioMovement = {
    id: crypto.randomUUID(),
    chatId,
    type: body.type as MovementType,
    ticker: body.ticker.toUpperCase(),
    amount: Number(body.amount),
    quantity: Number(body.quantity || 1),
    price: Number(body.price || body.amount),
    date: body.date,
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };

  await addMovement(movement);
  // audit log append-only
  try {
    const { addAuditEntry } = await import("@/lib/audit-history");
    const ua = req.headers.get("user-agent") || "unknown";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const where = (body.where as string) || "portfolio-analytics";
    const method = (body.method as string) || "manual";
    await addAuditEntry({ chatId, change: `Creó movimiento ${movement.type} ${movement.ticker} $${movement.amount} x${movement.quantity}`, where: where as any, method: method as any, userAgent: ua, ip });
  } catch {}
  return NextResponse.json({ ok: true, movement });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.chatId || !body.id) {
    return NextResponse.json({ ok: false, error: "chatId and id required" }, { status: 400 });
  }

  const updates: Partial<PortfolioMovement> = {};
  if (body.type) updates.type = body.type;
  if (body.ticker) updates.ticker = body.ticker.toUpperCase();
  if (body.amount) updates.amount = Number(body.amount);
  if (body.quantity) updates.quantity = Number(body.quantity);
  if (body.price) updates.price = Number(body.price);
  if (body.date) updates.date = body.date;
  if (body.notes !== undefined) updates.notes = body.notes;

  const ok = await updateMovement(body.chatId, body.id, updates);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Movement not found" }, { status: 404 });
  }
  try {
    const { addAuditEntry } = await import("@/lib/audit-history");
    const ua = req.headers.get("user-agent") || "unknown";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    await addAuditEntry({ chatId: body.chatId, change: `Actualizó movimiento ${body.id}`, where: "portfolio-analytics", method: "manual", userAgent: ua, ip });
  } catch {}
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  const id = req.nextUrl.searchParams.get("id");
  if (!chatId || !id) {
    return NextResponse.json({ ok: false, error: "chatId and id required" }, { status: 400 });
  }

  const ok = await deleteMovement(chatId, id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Movement not found" }, { status: 404 });
  }
  try {
    const { addAuditEntry } = await import("@/lib/audit-history");
    const ua = req.headers.get("user-agent") || "unknown";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    await addAuditEntry({ chatId, change: `Eliminó movimiento ${id}`, where: "portfolio-analytics", method: "manual", userAgent: ua, ip });
  } catch {}
  return NextResponse.json({ ok: true });
}
