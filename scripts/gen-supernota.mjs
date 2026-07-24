#!/usr/bin/env node
/*
 * Quartly Bot — scripts/gen-supernota.mjs
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Usage: node scripts/gen-supernota.mjs [chatId]
 * Generates today's supernota and shows KV records.
 */

import { createClient } from "@vercel/kv";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  env[key] = val;
  process.env[key] = val;
}

const kv = createClient({
  url: env.KV_REST_API_URL,
  token: env.KV_REST_API_TOKEN,
});

const chatId = process.argv[2] || "1676623921";

async function main() {
  console.log(`\n=== KV Records for chatId: ${chatId} ===\n`);

  // List all supernota keys
  try {
    const keys = await kv.keys(`supernota:${chatId}:*`);
    console.log(`Supernota records: ${keys.length}`);
    for (const key of keys.slice(0, 10)) {
      const val = await kv.get(key);
      if (val && typeof val === "object" && "date" in val) {
        console.log(`  ${key} → date: ${(val).date}, content length: ${(val as any).content?.length || 0}`);
      }
    }
  } catch (e: any) {
    console.log(`KV keys error: ${e.message}`);
  }

  // List earnings day records
  try {
    const earningsKeys = await kv.keys("earnings:day:*");
    console.log(`\nEarnings day records: ${earningsKeys.length}`);
    for (const key of earningsKeys.slice(0, 5)) {
      const val = await kv.get(key);
      if (val && typeof val === "object" && "tickers" in val) {
        const data = val as any;
        console.log(`  ${key} → ${data.tickers.length} tickers: ${data.tickers.map((t: any) => t.ticker).join(", ")}`);
      }
    }
  } catch (e: any) {
    console.log(`Earnings keys error: ${e.message}`);
  }

  // Generate supernota
  console.log(`\n=== Generating Supernota for ${chatId} ===\n`);

  try {
    const { generateDailyNewsSummary } = await import("../lib/news-summary.js");
    const summary = await generateDailyNewsSummary(chatId);
    console.log(summary);
  } catch (e: any) {
    console.log(`Error generating supernota: ${e.message}`);
    console.log(e.stack);
  }

  // Verify it was saved
  const today = new Date().toISOString().split("T")[0];
  try {
    const saved = await kv.get(`supernota:${chatId}:${today}`);
    if (saved) {
      console.log(`\n=== KV Record Confirmed ===`);
      console.log(`Key: supernota:${chatId}:${today}`);
      console.log(`Content length: ${(saved as any).content?.length || 0} chars`);
    }
  } catch (e: any) {
    console.log(`Verify error: ${e.message}`);
  }
}

main().catch(console.error);
