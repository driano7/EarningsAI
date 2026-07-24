/*
 * Quartly Bot — route.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/kv";

export async function GET() {
  const users = await getAllUsers();
  return NextResponse.json({ ok: true, users });
}
