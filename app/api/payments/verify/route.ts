import { NextRequest, NextResponse } from "next/server";
import { verifyPayment, NETWORK_LABELS } from "@/lib/payment-verification";
import { PaymentAsset, PaymentNetwork } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, asset, network, expectedAmount } = body;

    if (!address || !asset || !network) {
      return NextResponse.json({ ok: false, error: "address, asset, and network required" }, { status: 400 });
    }

    const result = await verifyPayment(
      address as string,
      asset as PaymentAsset,
      network as PaymentNetwork,
      expectedAmount ? Number(expectedAmount) : undefined
    );

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
}
