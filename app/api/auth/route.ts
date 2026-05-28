import { NextRequest, NextResponse } from "next/server";
import { getChatIdByEmail, generateLinkCode } from "@/lib/kv";

const VALID_EMAIL = "donovanriano@gmail.com";
const VALID_PASSWORD = process.env.DASHBOARD_PASSWORD || "Donovan";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email y contraseña requeridos" }, { status: 400 });
  }

  if (email.toLowerCase() !== VALID_EMAIL) {
    return NextResponse.json({ ok: false, error: "Email no registrado" }, { status: 401 });
  }

  if (password !== VALID_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" }, { status: 401 });
  }

  const chatId = await getChatIdByEmail(email);

  if (chatId) {
    return NextResponse.json({ ok: true, email: VALID_EMAIL, chatId });
  }

  const code = await generateLinkCode(email);
  return NextResponse.json({
    ok: true,
    email: VALID_EMAIL,
    needsLink: true,
    linkCode: code,
  });
}
