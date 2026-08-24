/*
 * Quartly Bot — lib/news-summary.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";
import { checkAndConsumeRateLimit } from "./api-ratelimit";
import { getTickerNews, getMarketNews, type NewsArticle } from "./news";
import { getMacroSnapshot, type MacroSerie } from "./macro";
import { getUserWatchlist } from "./kv";
import { checkAndConsumeQuota } from "./quota";
import { SP500 } from "./sp500";
import { ETFS } from "./etfs";
import { CUSTOM_TICKERS } from "./custom-tickers";
import { getQuote } from "./finnhub";
import { getAllSuperInvestorChanges, formatSuperInvestorForPrompt, type SuperInvestorChanges } from "./superinvestors";

export interface DailySummary {
  date: string;
  content: string;
  createdAt: number;
}

const SUMMARY_TTL_SECONDS = 30 * 86400;

function getTickerName(ticker: string): string {
  const sp = SP500.find((c) => c.ticker === ticker);
  if (sp) return sp.name;
  const etf = ETFS.find((e) => e.ticker === ticker);
  if (etf) return etf.name;
  const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
  if (custom) return custom.name;
  return ticker;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMacroForPrompt(macros: MacroSerie[]): string {
  if (macros.length === 0) return "No disponibles";
  return macros
    .filter((m) => m.value !== null)
    .map((m) => {
      const change = m.change !== null ? `${m.change >= 0 ? "+" : ""}${m.change.toFixed(3)}` : "N/A";
      return `- ${m.label}: ${m.value}${m.unit} (cambio: ${change})`;
    })
    .join("\n");
}

function formatNewsForPrompt(articles: NewsArticle[]): string {
  if (articles.length === 0) return "No hay noticias";
  return articles
    .slice(0, 8)
    .map((a) => `- [${a.source.name}] ${a.title}: ${a.description || ""}`)
    .join("\n");
}

function formatTickerNewsForPrompt(tickerNews: Array<{ ticker: string; articles: NewsArticle[] }>): string {
  if (tickerNews.length === 0) return "No hay noticias especificas de tickers";
  return tickerNews
    .flatMap(({ ticker, articles }) =>
      articles.map((a) => `- ${ticker}: ${a.title} — ${a.description || ""}`)
    )
    .join("\n");
}

function formatPricesForPrompt(prices: Array<{ ticker: string; current: number; change: number | null; prevClose: number | null }>): string {
  if (prices.length === 0) return "No hay precios disponibles";
  return prices
    .map((p) => {
      const changeStr = p.change !== null ? `${p.change >= 0 ? "+" : ""}${p.change.toFixed(2)}%` : "N/A";
      const prevStr = p.prevClose !== null ? ` (anterior: $${p.prevClose.toFixed(2)})` : "";
      return `- ${p.ticker}: $${p.current.toFixed(2)} (${changeStr})${prevStr}`;
    })
    .join("\n");
}

function buildSupernotaPrompt(
  today: string,
  macros: MacroSerie[],
  marketNews: NewsArticle[],
  tickerNews: Array<{ ticker: string; articles: NewsArticle[] }>,
  prices: Array<{ ticker: string; current: number; change: number | null; prevClose: number | null }>,
  allTickers: string[],
  superInvestorChanges: SuperInvestorChanges[]
): string {
  const macroText = formatMacroForPrompt(macros);
  const marketText = formatNewsForPrompt(marketNews);
  const tickerText = formatTickerNewsForPrompt(tickerNews);
  const priceText = formatPricesForPrompt(prices);
  const tickerList = allTickers.join(", ");
  const superInvestorText = superInvestorChanges.map(formatSuperInvestorForPrompt).join("\n");

  return `Eres un analista financiero experto especializado en tecnologia, semiconductores, IA, gaming, ciberseguridad y computacion cuantica. Genera la "Supernota" — un resumen ejecutivo diario para un inversionista retail activo.

FECHA: ${formatDate(today)}

PORTAFOLIO ACTIVO: ${tickerList}

PRECIOS ACTUALES (Finnhub):
${priceText}

INDICADORES MACRO (FRED):
${macroText}

NOTICIAS GENERALES DE MERCADO (NewsAPI + Finnhub):
${marketText}

NOTICIAS DE TICKERS DEL PORTAFOLIO (NewsAPI):
${tickerText}

SMART MONEY / SUPERINVERSORES (13F Último Trimestre):
${superInvestorText || "Sin datos disponibles"}

INSTRUCCIONES — FORMATO "SUPERNOTA" (MAXIMO 4000 PALABRAS):
1. Escribe en ESPANOL, tono directo, técnico y profesional.
2. Empieza con un titular de 1 linea que resuma el dia.
3. PORTAFOLIO ACTIVO: resumen de movimiento de los tickers mas relevantes con precio actual, % y direccion. Alertar tickers con movimiento superior a +/-3%.
4. MACRO CAVA: analiza VIX, correlacion, M2, bono 10 anos, oro, Bitcoin como indicadores. Indica si es dia de escalar o proteger.
5. SENALES DE ENTRADA: alertar trampas tecnicas o correcciones >=10% como ventanas de entrada.
6. CATALIZADORES: earnings, guidance, upgrades, contratos HBM/NAND, hitos relevantes.
7. SECCIÓN EXTRA - ANÁLISIS DE SMART MONEY (SUPERINVERSORES):
   Analiza los datos del Formulario 13F del trimestre actual suministrados para los 3 inversores clave y extrae conclusiones claras:
   - BERKSHIRE HATHAWAY (Referente S&P 500 / Valor & Calidad):
     * Compras/Ventas principales y lectura sobre la economía general.
   - PERSHING SQUARE - BILL ACKMAN (Referente Nasdaq / Big Tech):
     * Movimientos en consumo/tecnología y su apuesta de valoración.
   - DUQUESNE - STANLEY DRUCKENMILLER (Referente Semiconductores & IA):
     * Movimientos en la cadena de suministro de hardware/chips y ciclo tecnológico.
   REGLAS: Sé directo, conciso y técnico. Finaliza con una síntesis global indicando dónde coinciden estos tres grandes capitales.
8. CIERRE: semaforo macro — verde (escalar), amarillo (neutral), rojo (proteger). Justifica en 1 linea.
9. Usa emojis moderadamente para secciones.
10. NO uses markdown asterisks para negrita. Usa texto plano.
11. Maximo 4000 palabras.
12. Termina con: "— Quartly Supernota, ${today}"`;
}

async function fetchTickerPrices(tickers: string[]): Promise<Array<{ ticker: string; current: number; change: number | null; prevClose: number | null }>> {
  const prices: Array<{ ticker: string; current: number; change: number | null; prevClose: number | null }> = [];

  for (const ticker of tickers.slice(0, 20)) {
    const { allowed } = await checkAndConsumeRateLimit("ratelimit:finnhub", 60);
    if (!allowed) break;

    try {
      const quote = await getQuote(ticker);
      if (quote && quote.c > 0) {
        const change = quote.pc > 0 ? ((quote.c - quote.pc) / quote.pc) * 100 : null;
        prices.push({
          ticker,
          current: quote.c,
          change,
          prevClose: quote.pc > 0 ? quote.pc : null,
        });
      }
    } catch {
      // skip ticker
    }
  }

  return prices;
}

export async function generateDailyNewsSummary(chatId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const { stocks, etfs } = await getUserWatchlist(chatId);
  const allTickers = [...stocks, ...etfs];

  const [marketNews, macros, prices, superInvestorChanges] = await Promise.all([
    getMarketNews(8),
    getMacroSnapshot(),
    fetchTickerPrices(allTickers),
    getAllSuperInvestorChanges(),
  ]);

  const tickerNews: Array<{ ticker: string; articles: NewsArticle[] }> = [];
  for (const ticker of allTickers.slice(0, 15)) {
    const { allowed } = await checkAndConsumeRateLimit("ratelimit:news", 50);
    if (!allowed) break;

    const name = getTickerName(ticker);
    const articles = await getTickerNews(ticker, name, 2);
    if (articles.length > 0) {
      tickerNews.push({ ticker, articles });
    }
  }

  const { allowed: aiAllowed } = await checkAndConsumeQuota(1);

  if (aiAllowed) {
    const summary = await generateAISupernota(today, macros, marketNews, tickerNews, prices, allTickers, superInvestorChanges);
    if (summary) {
      await saveSummary(chatId, today, summary);
      return summary;
    }
  }

  let msg = `SUPERNOTA — ${formatDate(today)}\n\n`;

  if (prices.length > 0) {
    msg += `PORTAFOLIO:\n`;
    for (const p of prices) {
      const changeStr = p.change !== null ? `${p.change >= 0 ? "+" : ""}${p.change.toFixed(2)}%` : "N/A";
      msg += `  ${p.ticker}: $${p.current.toFixed(2)} (${changeStr})\n`;
    }
    msg += "\n";
  }

  if (macros.length > 0) {
    msg += `MACRO:\n`;
    for (const m of macros) {
      if (m.value === null) continue;
      const change = m.change !== null ? `${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}` : "N/A";
      const arrow = m.change !== null ? (m.change > 0 ? "^" : m.change < 0 ? "v" : "-") : "-";
      msg += `  ${arrow} ${m.label}: ${m.value}${m.unit} (${change})\n`;
    }
    msg += "\n";
  }

  if (marketNews.length > 0) {
    msg += `MERCADO:\n`;
    for (const article of marketNews.slice(0, 5)) {
      msg += `  > ${article.title}\n`;
    }
    msg += "\n";
  }

  if (tickerNews.length > 0) {
    msg += `NOTICIAS:\n`;
    for (const { ticker, articles } of tickerNews) {
      msg += `  ${ticker}:\n`;
      for (const article of articles) {
        msg += `    - ${article.title}\n`;
      }
    }
    msg += "\n";
  }

  if (superInvestorChanges.length > 0) {
    msg += `SMART MONEY / SUPERINVERSORES (13F):\n`;
    for (const s of superInvestorChanges) {
      msg += formatSuperInvestorForPrompt(s);
    }
    msg += "\n";
  }

  if (marketNews.length === 0 && tickerNews.length === 0 && macros.length === 0 && superInvestorChanges.length === 0) {
    msg += `_Sin datos disponibles hoy._`;
  }

  await saveSummary(chatId, today, msg);
  return msg;
}

export async function generateAISupernota(
  today: string,
  macros: MacroSerie[],
  marketNews: NewsArticle[],
  tickerNews: Array<{ ticker: string; articles: NewsArticle[] }>,
  prices: Array<{ ticker: string; current: number; change: number | null; prevClose: number | null }>,
  allTickers: string[],
  superInvestorChanges: SuperInvestorChanges[]
): Promise<string | null> {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
  if (!OPENROUTER_KEY) return null;

  const prompt = buildSupernotaPrompt(today, macros, marketNews, tickerNews, prices, allTickers, superInvestorChanges);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return content;
  } catch {
    return null;
  }
}

const SUMMARY_HISTORY_LIMIT = 30;
const HISTORY_INDEX_KEY = (chatId: string) => `supernota:idx:${chatId}`;

async function saveSummary(chatId: string, date: string, content: string): Promise<void> {
  const key = `supernota:${chatId}:${date}`;
  const entry: DailySummary = { date, content, createdAt: Date.now() };
  await kv.set(key, entry, { ex: SUMMARY_TTL_SECONDS });

  try {
    const idxKey = HISTORY_INDEX_KEY(chatId);
    const index = (await kv.get<{ date: string; createdAt: number }[]>(idxKey)) || [];
    index.push({ date, createdAt: entry.createdAt });
    index.sort((a, b) => b.createdAt - a.createdAt);
    const trimmed = index.slice(0, SUMMARY_HISTORY_LIMIT);
    await kv.set(idxKey, trimmed, { ex: SUMMARY_TTL_SECONDS });

    for (const stale of index.slice(SUMMARY_HISTORY_LIMIT)) {
      await kv.del(`supernota:${chatId}:${stale.date}`).catch(() => {});
    }
  } catch (err) {
    console.error(`[news-summary] saveSummary index update failed:`, err);
  }
}

export async function getSummaryHistory(chatId: string): Promise<DailySummary[]> {
  try {
    const idxKey = HISTORY_INDEX_KEY(chatId);
    const index = (await kv.get<{ date: string; createdAt: number }[]>(idxKey)) || [];

    if (index.length === 0) {
      const legacy = await scanLegacySummaryKeys(chatId);
      if (legacy.length > 0) {
        await kv.set(
          idxKey,
          legacy.map((e) => ({ date: e.date, createdAt: e.createdAt })),
          { ex: SUMMARY_TTL_SECONDS }
        );
        return legacy;
      }
      return [];
    }

    const entries: DailySummary[] = [];
    const concurrency = 5;
    let cursor = 0;
    async function worker() {
      while (cursor < index.length) {
        const item = index[cursor++];
        const entry = await kv.get<DailySummary>(`supernota:${chatId}:${item.date}`);
        if (entry) entries.push(entry);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, index.length) }, () => worker())
    );

    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error(`[news-summary] getSummaryHistory failed:`, err);
    return [];
  }
}

async function scanLegacySummaryKeys(chatId: string): Promise<DailySummary[]> {
  try {
    const keys: string[] = [];
    for await (const key of kv.scanIterator({ match: `supernota:${chatId}:*`, count: 100 })) {
      if (keys.length >= SUMMARY_HISTORY_LIMIT) break;
      keys.push(key);
    }
    if (keys.length === 0) return [];

    const entries: DailySummary[] = [];
    const concurrency = 5;
    let cursor = 0;
    async function worker() {
      while (cursor < keys.length) {
        const key = keys[cursor++];
        const entry = await kv.get<DailySummary>(key);
        if (entry) entries.push(entry);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, keys.length) }, () => worker())
    );

    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error(`[news-summary] scanLegacySummaryKeys failed:`, err);
    return [];
  }
}

export async function getSummaryForDate(chatId: string, date: string): Promise<DailySummary | null> {
  try {
    return await kv.get<DailySummary>(`supernota:${chatId}:${date}`);
  } catch {
    return null;
  }
}
