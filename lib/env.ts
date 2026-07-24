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
  NEWS_API_KEY: process.env.NEWS || "",
  FRED_API_KEY: process.env.FRED || "",
  COINMARKETCAP_API_KEY: process.env.COINMARKETCAP || "",
  CRON_SECRET: process.env.CRON_SECRET || "",
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || "",
};
