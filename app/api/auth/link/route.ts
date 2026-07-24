/*
 * Quartly Bot — route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { consumeLinkCode, setChatIdByEmail, setEmailByChatId } from "@/lib/kv";

export async function POST(req: NextRequest) {
  const { code, chatId } = await req.json();

  if (!code || !chatId) {
    return NextResponse.json({ ok: false, error: "code and chatId required" }, { status: 400 });
  }

  const email = await consumeLinkCode(code);
  if (!email) {
    return NextResponse.json({ ok: false, error: "Código inválido o expirado" }, { status: 400 });
  }

  await Promise.all([
    setChatIdByEmail(email, String(chatId)),
    setEmailByChatId(String(chatId), email),
  ]);

  return NextResponse.json({ ok: true, email, chatId: String(chatId) });
}
