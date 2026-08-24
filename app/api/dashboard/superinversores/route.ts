/*
 * Quartly Bot — app/api/dashboard/superinversores/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSuperInvestorChanges } from "@/lib/superinvestors";

export const revalidate = 86400; // 24h

export async function GET(req: NextRequest) {
  try {
    const changes = await getAllSuperInvestorChanges();

    if (changes.length === 0) {
      return NextResponse.json({ ok: false, error: "No 13F data available" }, { status: 503 });
    }

    const quarterEnd = changes[0]?.quarterEnd || new Date().toISOString().split("T")[0];

    return NextResponse.json({
      ok: true,
      date: quarterEnd,
      changes: changes.map((c) => ({
        investor: c.investor,
        investorName: c.investorName,
        quarterEnd: c.quarterEnd,
        filedAt: c.filedAt,
        topNew: c.topNew.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          action: h.action,
          changePct: h.changePct,
          prevShares: h.prevShares,
          currShares: h.currShares,
          currValue: h.currValue,
        })),
        topIncreased: c.topIncreased.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          action: h.action,
          changePct: h.changePct,
          prevShares: h.prevShares,
          currShares: h.currShares,
          currValue: h.currValue,
        })),
        topDecreased: c.topDecreased.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          action: h.action,
          changePct: h.changePct,
          prevShares: h.prevShares,
          currShares: h.currShares,
          currValue: h.currValue,
        })),
        topSoldOut: c.topSoldOut.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          action: h.action,
          changePct: h.changePct,
          prevShares: h.prevShares,
          currShares: h.currShares,
          currValue: h.currValue,
        })),
      })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}