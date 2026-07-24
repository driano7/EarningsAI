/*
 * Quartly Bot — app/api/dashboard/macro/route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextResponse } from "next/server";
import { getMacroSnapshot } from "@/lib/macro";

export async function GET() {
  try {
    const data = await getMacroSnapshot();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "FRED unavailable" }, { status: 503 });
  }
}
