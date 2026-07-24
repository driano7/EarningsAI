/*
 * Quartly Bot — app/api/dashboard/finance/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllUsers } from "@/lib/kv";
import { getSummary } from "@/lib/finance";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

function isAuthed(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${DASHBOARD_PASSWORD}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes") || undefined;

  const users = await getAllUsers();
  let totalIngresos = 0;
  let totalGastos = 0;
  let totalInversiones = 0;
  let userCount = 0;

  for (const userId of users) {
    const summary = await getSummary(userId, mes);
    if (summary) {
      totalIngresos += summary.ingresos;
      totalGastos += summary.gastos;
      totalInversiones += summary.inversiones;
      userCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    finance: {
      totalIngresos,
      totalGastos,
      totalInversiones,
      balance: totalIngresos - totalGastos - totalInversiones,
      userCount,
      mes: mes || new Date().toISOString().slice(0, 7),
    },
  });
}
