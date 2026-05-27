import { NextRequest, NextResponse } from "next/server";
import { getInvoices, createInvoice, updateInvoiceStatus, findAddressForAsset } from "@/lib/kv-payments";
import { PaymentAsset, PaymentInvoice } from "@/lib/types";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  const invoices = await getInvoices(chatId);
  return NextResponse.json({ ok: true, invoices });
}

export async function POST(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  try {
    const body = await req.json();
    const { asset, amountFiat, description } = body;

    const validAssets: PaymentAsset[] = ["BTC", "ETH", "USDC", "USDT", "SOL"];
    if (!asset || !validAssets.includes(asset) || !amountFiat || amountFiat <= 0) {
      return NextResponse.json({ ok: false, error: "Valid asset and amountFiat required" }, { status: 400 });
    }

    const addr = await findAddressForAsset(asset as PaymentAsset, asset === "SOL" ? "solana" : asset === "BTC" ? "bitcoin" : "ethereum");
    if (!addr) {
      return NextResponse.json({ ok: false, error: `No active address for ${asset}` }, { status: 400 });
    }

    const invoice: PaymentInvoice = {
      id: crypto.randomUUID(),
      chatId,
      asset: addr.asset,
      network: addr.network,
      address: addr.address,
      amount: amountFiat,
      amountFiat,
      fiatCurrency: "USD",
      status: "pending",
      description: description || undefined,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    await createInvoice(chatId, invoice);
    return NextResponse.json({ ok: true, invoice }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });

  try {
    const body = await req.json();
    const { id, status, txHash } = body;
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "id and status required" }, { status: 400 });
    }

    const success = await updateInvoiceStatus(chatId, id, status, txHash);
    if (!success) return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
}
