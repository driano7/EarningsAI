import { NextRequest, NextResponse } from "next/server";
import {
  getPaymentAddresses,
  addPaymentAddress,
  updatePaymentAddress,
  deletePaymentAddress,
  getGlobalPaymentAddresses,
  setGlobalPaymentAddresses,
} from "@/lib/kv-payments";
import { CryptoPaymentAddress } from "@/lib/types";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  const addresses = await getPaymentAddresses(chatId);
  return NextResponse.json({ ok: true, addresses });
}

export async function POST(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  try {
    const body = await req.json();
    const { asset, network, address, label } = body;

    if (!asset || !network || !address) {
      return NextResponse.json({ ok: false, error: "asset, network, and address required" }, { status: 400 });
    }

    const newAddress: CryptoPaymentAddress = {
      id: crypto.randomUUID(),
      chatId,
      asset,
      network,
      address,
      label: label || undefined,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await addPaymentAddress(chatId, newAddress);
    return NextResponse.json({ ok: true, address: newAddress }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const success = await updatePaymentAddress(chatId, id, updates);
    if (!success) return NextResponse.json({ ok: false, error: "Address not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const success = await deletePaymentAddress(chatId, id);
    if (!success) return NextResponse.json({ ok: false, error: "Address not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
}
