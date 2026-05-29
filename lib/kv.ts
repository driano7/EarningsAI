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

export async function getUserCryptos(chatId: string): Promise<string[]> {
  const cryptos = await kv.get<string[]>(`crypto:${chatId}`);
  return cryptos || [];
}

export async function addCrypto(chatId: string, ticker: string): Promise<{ ok: boolean; error?: string }> {
  const key = `crypto:${chatId}`;
  const cryptos = await getUserCryptos(chatId);
  const stocks = await getUserStocks(chatId);
  const etfs = await getUserEtfs(chatId);

  if (cryptos.includes(ticker)) return { ok: true };

  if (stocks.length + etfs.length + cryptos.length >= WATCHLIST_LIMIT) {
    return {
      ok: false,
      error: `❌ Alcanzaste el límite de 30 activos en tu watchlist.\nElimina uno con /mystocks, /myetfs o /mycryptos antes de agregar otro.`,
    };
  }

  cryptos.push(ticker);
  await kv.set(key, cryptos);
  await registerUser(chatId);
  return { ok: true };
}

export async function removeCrypto(chatId: string, ticker: string): Promise<void> {
  const cryptos = await getUserCryptos(chatId);
  await kv.set(`crypto:${chatId}`, cryptos.filter((t) => t !== ticker));
}

export interface FinanceTransaction {
  id: string;
  type: "income" | "expense" | "invest";
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: number;
}

export async function getFinanceTransactions(chatId: string): Promise<FinanceTransaction[]> {
  const txns = await kv.get<FinanceTransaction[]>(`finance:${chatId}:transactions`);
  return txns || [];
}

export async function addFinanceTransaction(chatId: string, txn: FinanceTransaction): Promise<void> {
  const txns = await getFinanceTransactions(chatId);
  txns.push(txn);
  await kv.set(`finance:${chatId}:transactions`, txns);
  await registerUser(chatId);
}

export async function removeFinanceTransaction(chatId: string, txnId: string): Promise<void> {
  const txns = await getFinanceTransactions(chatId);
  await kv.set(`finance:${chatId}:transactions`, txns.filter((t) => t.id !== txnId));
}

export const DEFAULT_CATEGORIES = {
  income: ["Salario", "Freelance", "Inversiones", "Ventas", "Otros ingresos"],
  expense: ["Comida", "Renta", "Transporte", "Entretenimiento", "Salud", "Educación", "Servicios", "Compras", "Otros gastos"],
};

export async function getUserCategories(chatId: string): Promise<{ income: string[]; expense: string[] }> {
  const cats = await kv.get<{ income: string[]; expense: string[] }>(`finance:${chatId}:categories`);
  return cats || DEFAULT_CATEGORIES;
}

export async function setUserCategories(chatId: string, cats: { income: string[]; expense: string[] }): Promise<void> {
  await kv.set(`finance:${chatId}:categories`, cats);
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

/* ─── Email ↔ ChatId linking ─────────────────────────────── */

export async function getChatIdByEmail(email: string): Promise<string | null> {
  const chatId = await kv.get<string>(`user:chatid:${email.toLowerCase()}`);
  return chatId ?? null;
}

export async function setChatIdByEmail(email: string, chatId: string): Promise<void> {
  await kv.set(`user:chatid:${email.toLowerCase()}`, chatId);
}

export async function getEmailByChatId(chatId: string): Promise<string | null> {
  const email = await kv.get<string>(`user:email:${chatId}`);
  return email ?? null;
}

export async function setEmailByChatId(chatId: string, email: string): Promise<void> {
  await kv.set(`user:email:${chatId}`, email.toLowerCase());
}

export async function generateLinkCode(email: string): Promise<string> {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const key = `link:${code}`;
  await kv.set(key, { email: email.toLowerCase(), createdAt: Date.now() });
  await kv.expire(key, 600);
  return code;
}

export async function consumeLinkCode(code: string): Promise<string | null> {
  const key = `link:${code.toUpperCase()}`;
  const data = await kv.get<{ email: string; createdAt: number }>(key);
  if (!data) return null;
  await kv.del(key);
  return data.email;
}

/* ─── Ticker earnings cache (shared: dashboard + Telegram bot) ─── */

export interface CachedTickerEarnings {
  logo: string | null;
  earnings: Array<{
    symbol: string;
    actual: number | null;
    estimate: number;
    surprise: number | null;
    surprisePercent: number | null;
    year: number;
    quarter: number;
    period: string;
  }>;
  analystSignals: Array<{
    buy: number;
    hold: number;
    sell: number;
    strongBuy: number;
    strongSell: number;
    period: string;
  }>;
  quote: {
    c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number;
  } | null;
  fetchedAt: number;
}

const TICKER_DATA_TTL = 86400;

export async function getCachedTickerData(ticker: string): Promise<CachedTickerEarnings | null> {
  const key = `ticker:data:${ticker.toUpperCase()}`;
  const data = await kv.get<CachedTickerEarnings>(key);
  if (!data) return null;
  const age = Date.now() - data.fetchedAt;
  if (age > TICKER_DATA_TTL * 1000) {
    await kv.del(key);
    return null;
  }
  return data;
}

export async function setCachedTickerData(ticker: string, data: Omit<CachedTickerEarnings, "fetchedAt">): Promise<void> {
  const key = `ticker:data:${ticker.toUpperCase()}`;
  await kv.set(key, { ...data, fetchedAt: Date.now() });
  await kv.expire(key, TICKER_DATA_TTL);
}
