import { NextRequest, NextResponse } from "next/server";
import { getSummary } from "@/lib/finance";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
  }

  const month = req.nextUrl.searchParams.get("month") || undefined;
  const summary = await getSummary(chatId, month);
  return NextResponse.json({ ok: true, summary });
}
