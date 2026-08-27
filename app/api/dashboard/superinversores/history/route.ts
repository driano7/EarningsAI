/*
 * Quartly Bot — app/api/dashboard/superinversores/history/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSuperInvestorsHistory, getSuperInvestorHistory, SUPERINVESTORS } from "@/lib/superinvestors";

export async function GET(req: NextRequest) {
  const investor = req.nextUrl.searchParams.get("investor") as string | null;
  try {
    if (investor && (investor === "BERKSHIRE" || investor === "PERSHING_SQUARE" || investor === "DUQUESNE")) {
      const history = await getSuperInvestorHistory(investor as any);
      return NextResponse.json({ ok: true, investor, history });
    }
    const all = await getAllSuperInvestorsHistory();
    return NextResponse.json({ ok: true, history: all });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
