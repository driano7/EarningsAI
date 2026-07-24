/*
 * Quartly Bot — lib/env.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

export const env = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY || "",
  TWELVEDATA_API_KEY: process.env.TWELVE || "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  KV_REST_API_URL: process.env.KV_REST_API_URL || "",
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN || "",
  NEWS_API_KEY: process.env.NEWS_API_KEY || "",
  FRED_API_KEY: process.env.FRED_API_KEY || "",
  CRON_SECRET: process.env.CRON_SECRET || "",
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};
