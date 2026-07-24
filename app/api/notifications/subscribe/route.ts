/*
 * Quartly Bot — app/api/notifications/subscribe/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription, removePushSubscription, type PushSubscription } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, subscription } = body as {
      chatId: string;
      subscription: PushSubscription;
    };

    if (!chatId || !subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
    }

    await savePushSubscription(chatId, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      chatId,
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const chatId = req.nextUrl.searchParams.get("chatId");
    if (!chatId) {
      return NextResponse.json({ ok: false, error: "Missing chatId" }, { status: 400 });
    }

    await removePushSubscription(chatId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
