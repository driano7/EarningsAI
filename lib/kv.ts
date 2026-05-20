/*
 * Quartly Bot — lib/kv.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";

const WATCHLIST_LIMIT = 30;

export async function getUserStocks(chatId: string): Promise<string[]> {
  const stocks = await kv.get<string[]>(`stocks:${chatId}`);
  return stocks || [];
}

export async function getUserEtfs(chatId: string): Promise<string[]> {
  const etfs = await kv.get<string[]>(`etfs:${chatId}`);
  return etfs || [];
}

export async function getUserWatchlist(chatId: string): Promise<{ stocks: string[]; etfs: string[] }> {
  const [stocks, etfs] = await Promise.all([
    getUserStocks(chatId),
    getUserEtfs(chatId),
  ]);
  return { stocks, etfs };
}

export async function addStock(chatId: string, ticker: string): Promise<{ ok: boolean; error?: string }> {
  const key = `stocks:${chatId}`;
  const stocks = await getUserStocks(chatId);
  const etfs = await getUserEtfs(chatId);

  if (stocks.includes(ticker)) return { ok: true };

  if (stocks.length + etfs.length >= WATCHLIST_LIMIT) {
    return {
      ok: false,
      error: `❌ Alcanzaste el límite de 30 activos en tu watchlist.\nElimina uno con /mystocks o /myetfs antes de agregar otro.`,
    };
  }

  stocks.push(ticker);
  await kv.set(key, stocks);
  await registerUser(chatId);
  return { ok: true };
}

export async function addEtf(chatId: string, ticker: string): Promise<{ ok: boolean; error?: string }> {
  const key = `etfs:${chatId}`;
  const stocks = await getUserStocks(chatId);
  const etfs = await getUserEtfs(chatId);

  if (etfs.includes(ticker)) return { ok: true };

  if (stocks.length + etfs.length >= WATCHLIST_LIMIT) {
    return {
      ok: false,
      error: `❌ Alcanzaste el límite de 30 activos en tu watchlist.\nElimina uno con /mystocks o /myetfs antes de agregar otro.`,
    };
  }

  etfs.push(ticker);
  await kv.set(key, etfs);
  await registerUser(chatId);
  return { ok: true };
}

export async function removeStock(chatId: string, ticker: string): Promise<void> {
  const stocks = await getUserStocks(chatId);
  await kv.set(`stocks:${chatId}`, stocks.filter((t) => t !== ticker));
}

export async function removeEtf(chatId: string, ticker: string): Promise<void> {
  const etfs = await getUserEtfs(chatId);
  await kv.set(`etfs:${chatId}`, etfs.filter((t) => t !== ticker));
}

export async function registerUser(chatId: string): Promise<void> {
  await kv.sadd("users", chatId);
}

export async function getAllUsers(): Promise<string[]> {
  const users = await kv.smembers("users");
  return users || [];
}

export async function hasReminded(chatId: string, ticker: string, date: string, type: string): Promise<boolean> {
  const key = `reminded:${chatId}:${ticker}:${date}:${type}`;
  const exists = await kv.get<boolean>(key);
  return !!exists;
}

export async function markReminded(chatId: string, ticker: string, date: string, type: string): Promise<void> {
  const key = `reminded:${chatId}:${ticker}:${date}:${type}`;
  await kv.set(key, true);
}
