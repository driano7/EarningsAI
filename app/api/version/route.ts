/*
 * Quartly Bot — app/api/version/route.ts
 * Verificar qué commit está sirviendo producción.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    commit: "c7b126ef+",
    features: ["audit-portfolio", "per-before-earning", "header-mobile-right", "superinvestors-tab", "candlestick"],
    timestamp: new Date().toISOString(),
  });
}
