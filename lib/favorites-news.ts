/*
 * Quartly Bot — lib/favorites-news.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";
import { getUserStocks, getUserEtfs, getUserCryptos } from "@/lib/kv";
import { SP500 } from "@/lib/sp500";
import { ETFS } from "@/lib/etfs";
import { CRYPTO_ID_MAP } from "@/lib/coingecko";
import { getTickerNews, type NewsArticle } from "@/lib/news";
import { getMacroSnapshot, type MacroSerie } from "@/lib/macro";
import { checkAndConsumeQuota } from "@/lib/quota";

export interface TickerNewsGroup {
  ticker: string;
  name: string;
  type: "stock" | "etf" | "crypto";
  articles: NewsArticle[];
  analysis: string | null;
}

export interface FavoritesNewsBundle {
  groups: TickerNewsGroup[];
  macro: MacroSerie[];
  generatedAt: number;
}

const ANALYSIS_COST = 1;

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function secondsUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(24, 0, 0, 0);
  return Math.max(Math.floor((end.getTime() - now.getTime()) / 1000), 60);
}

function getTickerName(ticker: string, type: "stock" | "etf" | "crypto"): string {
  if (type === "stock") return SP500.find((c) => c.ticker === ticker)?.name || ticker;
  if (type === "etf") return ETFS.find((e) => e.ticker === ticker)?.name || ticker;
  return CRYPTO_ID_MAP[ticker] || ticker;
}

function formatMacroSnapshot(macros: MacroSerie[]): string {
  return macros
    .filter((m) => m.value !== null)
    .map((m) => {
      const arrow = m.change !== null ? (m.change > 0 ? "^" : m.change < 0 ? "v" : "-") : "-";
      const change = m.change !== null ? `${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}` : "N/A";
      return `${m.label}: ${m.value}${m.unit} (${arrow} ${change})`;
    })
    .join("\n");
}

async function loadCached(chatId: string): Promise<FavoritesNewsBundle | null> {
  try {
    return await kv.get<FavoritesNewsBundle>(`favorites-news:daily:${chatId}:${todayStr()}`);
  } catch {
    return null;
  }
}

async function saveBundle(chatId: string, bundle: FavoritesNewsBundle): Promise<void> {
  await kv.set(`favorites-news:daily:${chatId}:${todayStr()}`, bundle, {
    ex: secondsUntilEndOfDay(),
  });
}

async function generateAnalyses(
  groups: Pick<TickerNewsGroup, "ticker" | "name" | "articles">[],
  macros: MacroSerie[],
  allTickers: string[]
): Promise<Record<string, string>> {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
  if (!OPENROUTER_KEY) return {};

  const { allowed } = await checkAndConsumeQuota(ANALYSIS_COST);
  if (!allowed) return {};

  const macroBlock = formatMacroSnapshot(macros) || "Sin datos macro.";
  const sections = groups
    .map((g) => {
      const news = g.articles.length > 0
        ? g.articles.map((a) => `- ${a.title}${a.description ? `: ${a.description.slice(0, 140)}` : ""}`).join("\n")
        : "Sin noticias recientes.";
      return `[${g.ticker}] ${g.name}\nNOTICIAS (7 días):\n${news}\n`;
    })
    .join("\n---\n\n");

  const prompt = `Eres un analista senior. Evalúa cada empresa del usuario considerando SUS NOTICIAS de los últimos 7 días y el CONTEXTO MACROECONÓMICO actual.

CONTEXTO MACRO:
${macroBlock}

Tu watchlist: ${allTickers.join(", ")}

${sections}

FORMATO OBLIGATORIO — usa estos delimitadores exactos, uno por ticker:
---SECTION:FAV_TICKER---
[análisis aquí]

Reglas (máximo 130 palabras por empresa):
- Empieza con una conclusión de 1 línea sobre la empresa (alcista / bajista / neutral).
- Relaciona las noticias de la empresa con los indicadores macro relevantes (desempleo, inflación, VIX, petróleo, dólar, curva 10Y-2Y) SOLO si tienen conexión real.
- Señala lo que vigilar: precio, soporte/resistencia, volumen.
- Sin markdown, texto plano con emojis.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      temperature: 0.3,
      max_tokens: 2500,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Analiza estos tickers: ${allTickers.join(", ")} usando las noticias y macro de arriba.` },
      ],
    }),
  }).catch(() => null);

  if (!res || !res.ok) return {};

  const data = (await res.json()) as { choices?: Array<{ message: { content: string } }> };
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) return {};

  const analyses: Record<string, string> = {};
  const parts = content.split("---SECTION:");
  for (const part of parts) {
    const close = part.indexOf("---");
    if (close === -1) continue;
    let ticker = part.substring(0, close).trim().toUpperCase();
    if (ticker.startsWith("FAV_")) ticker = ticker.substring(4);
    const body = part.substring(close + 3).trim();
    if (ticker && body) analyses[ticker] = body;
  }
  return analyses;
}

export async function getFavoritesNewsBundle(chatId: string, opts?: { byPassCache?: boolean }): Promise<FavoritesNewsBundle> {
  if (!opts?.byPassCache) {
    const cached = await loadCached(chatId);
    if (cached) return cached;
  }

  const [stocks, etfs, cryptos] = await Promise.all([
    getUserStocks(chatId).catch(() => [] as string[]),
    getUserEtfs(chatId).catch(() => [] as string[]),
    getUserCryptos(chatId).catch(() => [] as string[]),
  ]);

  const wanted = [
    ...stocks.map((t) => ({ ticker: t, type: "stock" as const })),
    ...etfs.map((t) => ({ ticker: t, type: "etf" as const })),
    ...cryptos.map((t) => ({ ticker: t, type: "crypto" as const })),
  ].slice(0, 10);

  const macro = await getMacroSnapshot();

  const groups: TickerNewsGroup[] = [];
  for (const { ticker, type } of wanted) {
    const name = getTickerName(ticker, type);
    const articles = await getTickerNews(ticker, name, 2);
    groups.push({ ticker, name, type, articles: articles.slice(0, 2), analysis: null });
  }

  const analyses = groups.some((g) => g.articles.length > 0)
    ? await generateAnalyses(groups, macro, wanted.map((w) => w.ticker))
    : {};

  for (const group of groups) {
    if (analyses[group.ticker]) {
      group.analysis = analyses[group.ticker];
    }
  }

  const bundle: FavoritesNewsBundle = {
    groups,
    macro,
    generatedAt: Date.now(),
  };

  await saveBundle(chatId, bundle);
  return bundle;
}