/*
 * Quartly Bot — api/webhook.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { registerUser, getUserStocks, getUserEtfs, getUserWatchlist, removeStock, removeEtf, addStock, addEtf } from "../lib/kv";
import { SP500 } from "../lib/sp500";
import { ETFS } from "../lib/etfs";
import { CUSTOM_TICKERS } from "../lib/custom-tickers";
import {
  getEarningsCalendar,
  getEarningsHistory,
  getRecommendationTrends,
  getQuote,
  formatEPSBlock,
  formatAnalystSignal,
} from "../lib/finnhub";
import { getLogoUrl } from "../lib/logo";
import { sendMessageWithLogo, sendMessage, answerInlineQuery } from "../lib/telegram";
import { checkAndConsumeQuota, getQuotaExceededMessage, getRemainingQuota } from "../lib/quota";
import { generateBatchReport, CompanyData } from "../lib/openrouter";
import { formatPriceBlock, PriceData } from "../lib/price";
import { getYahooPriceDataFull } from "../lib/yahoo";

const BOT_USERNAME = "@earningsinfoaibot";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "Quartly webhook is running" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  if (!body) return res.status(200).json({ ok: true });

  // Respond 200 immediately so Telegram doesn't retry
  res.status(200).json({ ok: true });

  if (body.inline_query) {
    await handleInlineQuery(body.inline_query).catch(console.error);
    return;
  }

  if (body.chosen_inline_result) {
    await handleChosenInlineResult(body.chosen_inline_result).catch(console.error);
    return;
  }

  if (body.callback_query) {
    await handleCallback(body.callback_query).catch(console.error);
    return;
  }

  if (body.message) {
    await handleMessage(body.message).catch(console.error);
    return;
  }
}

async function handleInlineQuery(query: { id: string; query: string; from: { id: number } }) {
  const searchText = (query.query || "").trim().toUpperCase();
  if (!searchText) return;

  const results: Array<{
    type: string;
    id: string;
    title: string;
    description: string;
    input_message_content: { message_text: string };
  }> = [];

  const spMatches = SP500.filter(
    (c) => c.ticker.toUpperCase().includes(searchText) || c.name.toUpperCase().includes(searchText)
  ).slice(0, 10);

  for (const c of spMatches) {
    results.push({
      type: "article",
      id: `stock_${c.ticker}`,
      title: `[${c.ticker}] ${c.name}`,
      description: `S&P 500 — ${c.sector}`,
      input_message_content: { message_text: `QUARTLY_ADD_STOCK:${c.ticker}` },
    });
  }

  const customMatches = CUSTOM_TICKERS.filter(
    (c) => c.ticker.toUpperCase().includes(searchText) || c.name.toUpperCase().includes(searchText)
  ).slice(0, 10 - results.length);

  for (const c of customMatches) {
    results.push({
      type: "article",
      id: `custom_${c.ticker}`,
      title: `[${c.ticker}] ${c.name}`,
      description: `Custom — ${c.sector}`,
      input_message_content: { message_text: `QUARTLY_ADD_CUSTOM:${c.ticker}` },
    });
  }

  const etfMatches = ETFS.filter(
    (e) => e.ticker.toUpperCase().includes(searchText) || e.name.toUpperCase().includes(searchText)
  ).slice(0, 10 - results.length);

  for (const e of etfMatches) {
    results.push({
      type: "article",
      id: `etf_${e.ticker}`,
      title: `[${e.ticker}] ${e.name}`,
      description: `ETF — ${e.category}`,
      input_message_content: { message_text: `QUARTLY_ADD_ETF:${e.ticker}` },
    });
  }

  await answerInlineQuery(query.id, results);
}

async function handleChosenInlineResult(
  chosen: { result_id: string; from: { id: number }; query: string }
) {
  const chatId = String(chosen.from.id);
  const resultId = chosen.result_id;

  await registerUser(chatId);

  if (resultId.startsWith("stock_")) {
    return handleAddFromInline(chatId, resultId.replace("stock_", ""), false);
  }
  if (resultId.startsWith("etf_")) {
    return handleAddFromInline(chatId, resultId.replace("etf_", ""), true);
  }
  if (resultId.startsWith("custom_")) {
    const ticker = resultId.replace("custom_", "");
    const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
    if (custom) return handleAddFromInline(chatId, ticker, custom.isEtf);
  }
}

async function handleCallback(cb: { id: string; data: string; message: { chat: { id: number } } }) {
  const chatId = String(cb.message.chat.id);
  const [action, ticker] = cb.data.split(":");

  if (action === "remove_stock") {
    await removeStock(chatId, ticker);
    await sendMessage(chatId, `🗑️ *${ticker}* eliminado de tu watchlist de acciones.`);
  } else if (action === "remove_etf") {
    await removeEtf(chatId, ticker);
    await sendMessage(chatId, `🗑️ *${ticker}* eliminado de tu watchlist de ETFs.`);
  }

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cb.id }),
  });
}

function resolveTickerInfo(ticker: string): { name: string; sector: string } {
  const sp = SP500.find((c) => c.ticker === ticker);
  if (sp) return { name: sp.name, sector: sp.sector };
  const etf = ETFS.find((e) => e.ticker === ticker);
  if (etf) return { name: etf.name, sector: etf.category };
  const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
  if (custom) return { name: custom.name, sector: custom.sector };
  return { name: ticker, sector: "" };
}

// Builds a full ticker card: price variations + EPS history + analyst signal + next report date
async function buildTickerCard(ticker: string, isEtf: boolean): Promise<{ msg: string; logoUrl: string }> {
  const { name, sector } = resolveTickerInfo(ticker);

  const [quote, recs, history, logoUrl, yahooData] = await Promise.all([
    getQuote(ticker),
    getRecommendationTrends(ticker),
    isEtf ? Promise.resolve([]) : getEarningsHistory(ticker),
    getLogoUrl(ticker, isEtf),
    getYahooPriceDataFull(ticker),
  ]);

  const priceData: PriceData = {
    current: yahooData?.current ?? quote?.c ?? 0,
    change1d: yahooData?.change1d ?? quote?.dp ?? null,
    change1w: yahooData?.change1w ?? null,
    change1m: yahooData?.change1m ?? null,
    change3m: yahooData?.change3m ?? null,
    change1y: yahooData?.change1y ?? null,
    high52w: yahooData?.high52w ?? null,
    low52w: yahooData?.low52w ?? null,
  };

  let msg = formatPriceBlock(ticker, name, sector, priceData);

  if (isEtf) {
    const analystSignal = formatAnalystSignal(recs);
    msg += `\n\n${analystSignal}\n📊 ETF — sin reportes de earnings`;
  } else {
    const epsBlock = formatEPSBlock(history);
    const analystSignal = formatAnalystSignal(recs);

    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + 90);
    const calendar = await getEarningsCalendar(today, future.toISOString().split("T")[0]);
    const upcoming = calendar.find((e) => e.symbol === ticker);
    const nextReport = upcoming
      ? `📅 Próximo reporte: ${upcoming.date} (${upcoming.hour || "N/A"})`
      : "📅 Próximo reporte: Sin fecha confirmada";

    msg += `\n\n${epsBlock ? epsBlock + "\n\n" : ""}${analystSignal}\n${nextReport}`;
  }

  return { msg, logoUrl };
}

async function handleAddFromInline(chatId: string, ticker: string, isEtf: boolean) {
  const result = isEtf ? await addEtf(chatId, ticker) : await addStock(chatId, ticker);

  if (!result.ok && result.error) {
    await sendMessage(chatId, result.error);
    return;
  }

  const { msg, logoUrl } = await buildTickerCard(ticker, isEtf);
  const fullMsg = msg + `\n\n✅ *${ticker}* agregado a tus favoritos`;

  const removeBtn = isEtf ? `remove_etf:${ticker}` : `remove_stock:${ticker}`;
  const replyMarkup = {
    inline_keyboard: [[{ text: "🗑️ Eliminar de favoritos", callback_data: removeBtn }]],
  };

  await sendMessageWithLogo(chatId, fullMsg, logoUrl, "Markdown", replyMarkup);
}

async function handleMessage(message: { chat: { id: number; first_name?: string }; text?: string }) {
  const chatId = String(message.chat.id);
  const text = (message.text || "").trim();

  if (text.startsWith("QUARTLY_ADD_STOCK:")) {
    return handleAddFromInline(chatId, text.replace("QUARTLY_ADD_STOCK:", ""), false);
  }
  if (text.startsWith("QUARTLY_ADD_ETF:")) {
    return handleAddFromInline(chatId, text.replace("QUARTLY_ADD_ETF:", ""), true);
  }
  if (text.startsWith("QUARTLY_ADD_CUSTOM:")) {
    const ticker = text.replace("QUARTLY_ADD_CUSTOM:", "");
    const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
    if (custom) return handleAddFromInline(chatId, ticker, custom.isEtf);
    return;
  }

  const cmd = text.split("@")[0].trim();

  if (cmd === "/start") {
    await registerUser(chatId);
    const name = message.chat.first_name || "inversor";
    const welcome = `¡Hola ${name}! 👋 Soy *Quartly*, tu asistente de earnings e información financiera para el S\\&P 500 y ETFs\\.

📊 *¿Qué puedo hacer?*
• Rastrear empresas del S\\&P 500 y ETFs en tu watchlist
• Enviarte recordatorios antes de reportes de earnings
• Analizar resultados con IA cuando publican
• Ranking semanal de hype de earnings

🔍 *Cómo agregar activos:*
Escribe ${BOT_USERNAME} y el ticker o nombre de la empresa/ETF en cualquier chat\\. Selecciona el resultado para agregarlo a tu watchlist\\.

📋 *Comandos disponibles:*
/start — Bienvenida y cómo usar Quartly
/mystocks — Ver y eliminar acciones de tu watchlist
/myetfs — Ver y eliminar ETFs de tu watchlist
/report — Reporte completo de cada activo en tu watchlist`;
    await sendMessage(chatId, welcome);
    return;
  }

  if (cmd === "/mystocks") return handleMyStocks(chatId);
  if (cmd === "/myetfs") return handleMyEtfs(chatId);
  if (cmd === "/report") return handleReport(chatId);
}

async function handleMyStocks(chatId: string) {
  const stocks = await getUserStocks(chatId);
  if (stocks.length === 0) {
    await sendMessage(chatId, `📋 No tienes acciones en tu watchlist. Usa ${BOT_USERNAME} para agregar.`);
    return;
  }

  let msg = "📋 *Tus acciones:*\n\n";
  for (const ticker of stocks) {
    const company = SP500.find((c) => c.ticker === ticker);
    const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
    const name = company ? company.name : custom ? custom.name : ticker;
    const sector = company ? company.sector : custom ? custom.sector : "";
    msg += `• *${ticker}* — ${name} (${sector})\n`;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  const kb = stocks.map((t) => ({ text: `🗑️ ${t}`, callback_data: `remove_stock:${t}` }));
  for (let i = 0; i < kb.length; i += 2) buttons.push(kb.slice(i, i + 2));

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
      disable_web_page_preview: true,
    }),
  });
}

async function handleMyEtfs(chatId: string) {
  const etfs = await getUserEtfs(chatId);
  if (etfs.length === 0) {
    await sendMessage(chatId, `📋 No tienes ETFs en tu watchlist. Usa ${BOT_USERNAME} para agregar.`);
    return;
  }

  let msg = "📋 *Tus ETFs:*\n\n";
  for (const ticker of etfs) {
    const etf = ETFS.find((e) => e.ticker === ticker);
    const name = etf ? etf.name : ticker;
    const category = etf ? etf.category : "";
    msg += `• *${ticker}* — ${name} (${category})\n`;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  const kb = etfs.map((t) => ({ text: `🗑️ ${t}`, callback_data: `remove_etf:${t}` }));
  for (let i = 0; i < kb.length; i += 2) buttons.push(kb.slice(i, i + 2));

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
      disable_web_page_preview: true,
    }),
  });
}

async function handleReport(chatId: string) {
  const { stocks, etfs } = await getUserWatchlist(chatId);
  const allTickers = [...stocks, ...etfs];

  if (allTickers.length === 0) {
    await sendMessage(chatId, `No tienes activos en tu watchlist. Usa ${BOT_USERNAME} para agregar.`);
    return;
  }

  // Check which tickers from watchlist are reporting today
  const today = new Date().toISOString().split("T")[0];
  const calendar = await getEarningsCalendar(today, today);
  const reportingTodaySymbols = new Set(calendar.filter((e) => allTickers.includes(e.symbol)).map((e) => e.symbol));

  // Send one full card per ticker, sequentially to avoid rate limits
  for (const ticker of allTickers) {
    const isEtf = etfs.includes(ticker);

    // If reporting today, use AI analysis (or raw fallback)
    if (reportingTodaySymbols.has(ticker)) {
      const event = calendar.find((e) => e.symbol === ticker)!;
      const { name, sector } = resolveTickerInfo(ticker);
      const logoUrl = await getLogoUrl(ticker, isEtf);
      const [history, recs, quote] = await Promise.all([
        isEtf ? Promise.resolve([]) : getEarningsHistory(ticker),
        getRecommendationTrends(ticker),
        getQuote(ticker),
      ]);

      const quota = await checkAndConsumeQuota(1);
      if (quota.allowed) {
        const companyData: CompanyData = {
          ticker,
          name,
          sector,
          date: event.date,
          hour: event.hour || "N/A",
          epsEstimate: event.estimate,
          epsActual: event.actual ?? null,
          revenueEstimate: event.revenueEstimate ?? null,
          surprisePercent: event.surprisePercent ?? null,
          price: quote ? quote.c : null,
          analystSignal: formatAnalystSignal(recs),
          epsHistory: isEtf ? "N/A (ETF)" : formatEPSBlock(history),
        };
        const report = await generateBatchReport({ favReports: [companyData], hypeRanking: null });
        const analysis = report.favReports[ticker];
        if (analysis) {
          await sendMessageWithLogo(chatId, analysis, logoUrl);
          continue;
        }
      }
      // Fallback to raw message if AI quota exceeded
      const rawMsg = buildRawEarningsMessage(event, name, sector, quote, recs, history, isEtf);
      await sendMessageWithLogo(chatId, rawMsg, logoUrl);
      continue;
    }

    // Normal day: full ticker card (price + EPS history + analyst + next report date)
    const { msg, logoUrl } = await buildTickerCard(ticker, isEtf);
    await sendMessageWithLogo(chatId, msg, logoUrl);
  }

  const remaining = await getRemainingQuota();
  if (remaining <= 0) {
    await sendMessage(chatId, getQuotaExceededMessage());
  }
}

function buildRawEarningsMessage(
  event: { symbol: string; date: string; hour?: string; estimate: number; actual?: number | null; revenueEstimate?: number | null; surprisePercent?: number | null },
  name: string,
  sector: string,
  quote: { c: number; dp: number } | null,
  recs: unknown[],
  history: unknown[],
  isEtf: boolean
): string {
  const epsActual = event.actual != null ? `$${event.actual.toFixed(2)}` : "N/A";
  const surprise = event.surprisePercent != null
    ? `${event.surprisePercent >= 0 ? "+" : ""}${event.surprisePercent.toFixed(1)}%`
    : "N/A";
  const priceText = quote ? `Precio: $${quote.c.toFixed(2)} (${quote.dp >= 0 ? "+" : ""}${quote.dp.toFixed(2)}%)` : "Precio: N/A";
  const signal = formatAnalystSignal(recs as never[]);
  const epsBlock = isEtf ? "" : formatEPSBlock(history as never[]);

  return `📊 *${event.symbol}* — ${name} (${sector})
Fecha: ${event.date} (${event.hour || "N/A"})
EPS Est: $${event.estimate.toFixed(2)} | EPS Real: ${epsActual}
Surprise: ${surprise}
${priceText}
${signal}
${epsBlock ? epsBlock + "\n" : ""}⚠️ Análisis con IA no disponible. Límite alcanzado.`;
}
