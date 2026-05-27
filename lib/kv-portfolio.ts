/*
 * Quartly Bot — lib/kv-portfolio.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";
import type { PortfolioPosition, Transaction } from "./types";

export async function getPositions(chatId: string): Promise<PortfolioPosition[]> {
  const positions = await kv.get<PortfolioPosition[]>(`portfolio:${chatId}`);
  return positions || [];
}

export async function addPosition(chatId: string, position: PortfolioPosition): Promise<void> {
  const positions = await getPositions(chatId);
  positions.push(position);
  await kv.set(`portfolio:${chatId}`, positions);
}

export async function updatePosition(chatId: string, id: string, updates: Partial<PortfolioPosition>): Promise<boolean> {
  const positions = await getPositions(chatId);
  const index = positions.findIndex((p) => p.id === id);
  if (index === -1) return false;
  positions[index] = { ...positions[index], ...updates };
  await kv.set(`portfolio:${chatId}`, positions);
  return true;
}

export async function deletePosition(chatId: string, id: string): Promise<boolean> {
  const positions = await getPositions(chatId);
  const filtered = positions.filter((p) => p.id !== id);
  if (filtered.length === positions.length) return false;
  await kv.set(`portfolio:${chatId}`, filtered);
  return true;
}

export async function getTransactions(chatId: string): Promise<Transaction[]> {
  const txns = await kv.get<Transaction[]>(`transactions:${chatId}`);
  return txns || [];
}

export async function addTransaction(chatId: string, txn: Transaction): Promise<void> {
  const txns = await getTransactions(chatId);
  txns.push(txn);
  await kv.set(`transactions:${chatId}`, txns);
}
