/*
 * Quartly Bot — app/api/dashboard/audit/history/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuditHistory, addAuditEntry } from "@/lib/audit-history";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  const history = await getAuditHistory(chatId);
  return NextResponse.json({ ok: true, history });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const chatId = body.chatId;
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  const ua = req.headers.get("user-agent") || body.userAgent || "unknown";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const entry = await addAuditEntry({
    chatId,
    change: body.change || "Cambio sin descripción",
    where: body.where || "api",
    method: body.method || "manual",
    userAgent: ua,
    ip,
  });
  return NextResponse.json({ ok: true, entry });
}
