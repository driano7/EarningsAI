/*
 * Quartly Bot — lib/portfolio-history.ts
 * Copyright (c) Donovan Riano. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";

export type MovementType = "buy" | "sell" | "dividend" | "deposit" | "withdrawal" | "transfer";

export interface PortfolioMovement {
  id: string;
  chatId: string;
  type: MovementType;
  ticker: string;
  amount: number;
  quantity: number;
  price: number;
  date: string;
  notes: string;
  createdAt: string;
}

export interface MonthlySnapshot {
  month: string;
  totalValue: number;
  stocksValue: number;
  sofiposValue: number;
  cryptoValue: number;
  netInvested: number;
  movements: number;
}

const HISTORY_TTL = 365 * 86400;

export async function getMovements(chatId: string): Promise<PortfolioMovement[]> {
  const data = await kv.get<PortfolioMovement[]>(`portfolio:history:${chatId}`);
  return (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function addMovement(movement: PortfolioMovement): Promise<void> {
  const existing = await getMovements(movement.chatId);
  existing.push(movement);
  await kv.set(`portfolio:history:${movement.chatId}`, existing, { ex: HISTORY_TTL });
}

export async function deleteMovement(chatId: string, id: string): Promise<boolean> {
  const existing = await getMovements(chatId);
  const filtered = existing.filter((m) => m.id !== id);
  if (filtered.length === existing.length) return false;
  await kv.set(`portfolio:history:${chatId}`, filtered, { ex: HISTORY_TTL });
  return true;
}

export async function updateMovement(chatId: string, id: string, updates: Partial<PortfolioMovement>): Promise<boolean> {
  const existing = await getMovements(chatId);
  const idx = existing.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  existing[idx] = { ...existing[idx], ...updates };
  await kv.set(`portfolio:history:${chatId}`, existing, { ex: HISTORY_TTL });
  return true;
}

export function filterByPeriod(movements: PortfolioMovement[], period: string): PortfolioMovement[] {
  if (period === "all") return movements;
  const now = new Date();
  const daysMap: Record<string, number> = {
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
  };
  const days = daysMap[period] || 365;
  const cutoff = new Date(now.getTime() - days * 86400000);
  return movements.filter((m) => new Date(m.date) >= cutoff);
}

export function computeMonthlySnapshots(movements: PortfolioMovement[]): MonthlySnapshot[] {
  const monthMap = new Map<string, MonthlySnapshot>();

  for (const m of movements) {
    const month = m.date.slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, {
        month,
        totalValue: 0,
        stocksValue: 0,
        sofiposValue: 0,
        cryptoValue: 0,
        netInvested: 0,
        movements: 0,
      });
    }
    const snap = monthMap.get(month)!;
    snap.movements++;

    const value = m.amount * m.quantity;

    if (m.type === "buy" || m.type === "deposit") {
      snap.netInvested += value;
      if (m.ticker === "SOFIPO" || m.ticker === "CETES") {
        snap.sofiposValue += value;
      } else if (["BTC", "ETH", "SOL"].includes(m.ticker)) {
        snap.cryptoValue += value;
      } else {
        snap.stocksValue += value;
      }
    } else if (m.type === "sell" || m.type === "withdrawal") {
      snap.netInvested -= value;
      if (m.ticker === "SOFIPO" || m.ticker === "CETES") {
        snap.sofiposValue -= value;
      } else if (["BTC", "ETH", "SOL"].includes(m.ticker)) {
        snap.cryptoValue -= value;
      } else {
        snap.stocksValue -= value;
      }
    } else if (m.type === "dividend") {
      snap.netInvested += value;
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function computeSummary(movements: PortfolioMovement[]) {
  let totalInvested = 0;
  let totalWithdrawn = 0;
  let totalDividends = 0;
  let buyCount = 0;
  let sellCount = 0;
  const byType = new Map<string, number>();
  const byTicker = new Map<string, number>();

  for (const m of movements) {
    const value = m.amount * m.quantity;

    if (m.type === "buy" || m.type === "deposit") {
      totalInvested += value;
      buyCount++;
    } else if (m.type === "sell" || m.type === "withdrawal") {
      totalWithdrawn += value;
      sellCount++;
    } else if (m.type === "dividend") {
      totalDividends += value;
    }

    byType.set(m.type, (byType.get(m.type) || 0) + value);
    byTicker.set(m.ticker, (byTicker.get(m.ticker) || 0) + value);
  }

  return {
    totalInvested,
    totalWithdrawn,
    totalDividends,
    netFlow: totalInvested - totalWithdrawn,
    buyCount,
    sellCount,
    totalMovements: movements.length,
    byType: Object.fromEntries(byType),
    byTicker: Object.fromEntries(byTicker),
  };
}
