/*
 * Quartly Bot — app/api/telegram-status/route.ts
 * Diagnóstico sin exponer el token: webhook info + comandos registrados.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) {
    return NextResponse.json({ ok: false, hasToken: false, error: "TELEGRAM_BOT_TOKEN not set en Vercel" }, { status: 500 });
  }
  try {
    const [wh, cmds] = await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json()),
      fetch(`https://api.telegram.org/bot${token}/getMyCommands`).then((r) => r.json()),
    ]);
    return NextResponse.json({
      ok: true,
      hasToken: true,
      webhookUrl: wh?.result?.url || null,
      pendingUpdates: wh?.result?.pending_update_count ?? null,
      lastError: wh?.result?.last_error_message || null,
      lastErrorDate: wh?.result?.last_error_date || null,
      commandsCount: Array.isArray(cmds?.result) ? cmds.result.length : 0,
      commands: cmds?.result || [],
    });
  } catch (err) {
    return NextResponse.json({ ok: false, hasToken: true, error: String(err) }, { status: 500 });
  }
}
