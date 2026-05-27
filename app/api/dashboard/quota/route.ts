import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getRemainingQuota } from "@/lib/quota";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const remaining = await getRemainingQuota();
  const data = await kv.get<{ used: number; resetDate: string }>("openrouter_quota");

  return NextResponse.json({
    ok: true,
    quota: {
      used: data?.used || 0,
      remaining,
      total: 25,
      resetDate: data?.resetDate || new Date().toISOString().split("T")[0],
    },
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await req.json();

  if (action === "reset") {
    const today = new Date().toISOString().split("T")[0];
    await kv.set("openrouter_quota", { used: 0, resetDate: today });
    return NextResponse.json({ ok: true, message: "Quota reset" });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
