import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/kv";

export async function GET() {
  const users = await getAllUsers();
  return NextResponse.json({ ok: true, users });
}
