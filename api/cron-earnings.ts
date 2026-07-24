/*
 * Quartly Bot — api/cron-earnings.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { env } from "../lib/env";
import { getAllUsers, getUserWatchlist } from "../lib/kv";
import { getEarningsCalendar, getCompanyProfile, type CalendarEarning } from "../lib/finnhub";
import { sendEarningsReminder } from "../lib/notifications";
import { SP500 } from "../lib/sp500";
import { ETFS } from "../lib/etfs";

export const maxDuration = 300;

interface StoredEarningsDay {
  date: string;
  tickers: Array<{
    ticker: string;
    name: string;
    logo: string | null;
    estimate: number;
    hour?: string;
  }>;
  fetchedAt: number;
}

function getTickerName(ticker: string): string {
  const sp = SP500.find((c) => c.ticker === ticker);
  if (sp) return sp.name;
  const etf = ETFS.find((e) => e.ticker === ticker);
  if (etf) return etf.name;
  return ticker;
}

function getLogoUrl(ticker: string): string {
  const name = getTickerName(ticker);
  const domain = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .join("");
  return `https://logo.clearbit.com/${domain}.com`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const to = future.toISOString().split("T")[0];

  const users = await getAllUsers();
  if (users.length === 0) {
    return res.status(200).json({ ok: true, message: "No users" });
  }

  // 1. Fetch all unique tickers across all users
  const allTickersSet = new Set<string>();
  for (const chatId of users) {
    const { stocks } = await getUserWatchlist(chatId);
    for (const t of stocks) allTickersSet.add(t);
  }

  const allTickers = [...allTickersSet];

  // 2. Fetch earnings calendar for next 30 days (global + per ticker for accuracy)
  const [globalCalendar] = await Promise.all([
    getEarningsCalendar(from, to),
  ]);

  // Per-ticker calendar for accuracy
  const tickerCalendars = new Map<string, CalendarEarning[]>();
  for (const ticker of allTickers.slice(0, 30)) {
    const cal = await getEarningsCalendar(from, to, ticker);
    if (cal.length > 0) {
      tickerCalendars.set(ticker, cal);
    }
    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  // 3. Group earnings by date
  const earningsByDate = new Map<string, StoredEarningsDay["tickers"]>();

  // Merge global calendar
  for (const event of globalCalendar) {
    if (!event.date) continue;
    if (!earningsByDate.has(event.date)) earningsByDate.set(event.date, []);

    const tickers = earningsByDate.get(event.date)!;
    if (!tickers.some((t) => t.ticker === event.symbol)) {
      tickers.push({
        ticker: event.symbol,
        name: event.name || event.symbol,
        logo: getLogoUrl(event.symbol),
        estimate: event.estimate,
        hour: event.hour,
      });
    }
  }

  // Merge per-ticker calendar
  for (const [ticker, events] of tickerCalendars) {
    for (const event of events) {
      if (!event.date) continue;
      if (!earningsByDate.has(event.date)) earningsByDate.set(event.date, []);

      const tickers = earningsByDate.get(event.date)!;
      if (!tickers.some((t) => t.ticker === event.symbol)) {
        tickers.push({
          ticker: event.symbol,
          name: event.name || getTickerName(ticker),
          logo: getLogoUrl(ticker),
          estimate: event.estimate,
          hour: event.hour,
        });
      }
    }
  }

  // 4. Store earnings in KV (30-day TTL)
  const storePromises: Promise<void>[] = [];
  for (const [date, tickers] of earningsByDate) {
    const dayData: StoredEarningsDay = {
      date,
      tickers,
      fetchedAt: Date.now(),
    };
    storePromises.push(
      kv.set(`earnings:day:${date}`, dayData, { ex: 86400 * 35 })
    );
  }
  await Promise.all(storePromises);

  // 5. Send push notifications for earnings in 2 days
  const twoDaysFromNow = new Date();
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  const twoDaysStr = twoDaysFromNow.toISOString().split("T")[0];

  const earningsIn2Days = earningsByDate.get(twoDaysStr) || [];

  // Match against each user's watchlist
  let notificationsSent = 0;
  for (const chatId of users) {
    const { stocks } = await getUserWatchlist(chatId);
    const stockSet = new Set(stocks);

    const relevantTickers = earningsIn2Days.filter((e) => stockSet.has(e.ticker));

    if (relevantTickers.length > 0) {
      const sent = await sendEarningsReminder(chatId, relevantTickers.map((t) => ({
        ticker: t.ticker,
        name: t.name,
        date: twoDaysStr,
      })));
      if (sent) notificationsSent++;
    }
  }

  return res.status(200).json({
    ok: true,
    tickersTracked: allTickers.length,
    earningsDaysStored: earningsByDate.size,
    notificationsSent,
    usersChecked: users.length,
  });
}
