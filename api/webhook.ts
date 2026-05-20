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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "Quartly webhook is running" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  if (!body) return res.status(200).json({ ok: true });

  if (body.inline_query) {
    return handleInlineQuery(res, body.inline_query);
  }

  if (body.callback_query) {
    return handleCallback(res, body.callback_query);
  }

  if (body.message) {
    return handleMessage(res, body.message);
  }

  return res.status(200).json({ ok: true });
}

async function handleInlineQuery(res: VercelResponse, query: { id: string; query: string; from: { id: number } }) {
  const searchText = (query.query || "").trim().toUpperCase();
  if (!searchText) {
    return res.status(200).json({ ok: true });
  }

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
  return res.status(200).json({ ok: true });
}

async function handleCallback(res: VercelResponse, cb: { id: string; data: string; message: { chat: { id: number }; text: string } }) {
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

  return res.status(200).json({ ok: true });
}

function resolveTickerInfo(ticker: string): { name: string; sector: string } {
  const spCompany = SP500.find((c) => c.ticker === ticker);
  if (spCompany) return { name: spCompany.name, sector: spCompany.sector };

  const etfObj = ETFS.find((e) => e.ticker === ticker);
  if (etfObj) return { name: etfObj.name, sector: etfObj.category };

  const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
  if (custom) return { name: custom.name, sector: custom.sector };

  return { name: ticker, sector: "" };
}

async function handleAddFromInline(res: VercelResponse, chatId: string, ticker: string, isEtf: boolean) {
  const result = isEtf ? await addEtf(chatId, ticker) : await addStock(chatId, ticker);

  if (!result.ok && result.error) {
    await sendMessage(chatId, result.error);
    return res.status(200).json({ ok: true });
  }

  const { name, sector: sectorOrCategory } = resolveTickerInfo(ticker);

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
    high52w: yahooData?.high52w ?? quote?.h ?? null,
    low52w: yahooData?.low52w ?? quote?.l ?? null,
  };

  const msg = formatPriceBlock(ticker, name, sectorOrCategory, priceData);

  let fullMsg = msg;

  if (isEtf) {
    const analystSignal = formatAnalystSignal(recs);
    fullMsg += `\n\n${analystSignal}\n📊 ETF — sin reportes de earnings`;
  } else {
    const epsBlock = formatEPSBlock(history);
    const analystSignal = formatAnalystSignal(recs);

    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const calendar = await getEarningsCalendar(today, future.toISOString().split("T")[0]);
    const upcoming = calendar.find((e) => e.symbol === ticker);
    const nextReport = upcoming
      ? `📅 Próximo reporte estimado: ${upcoming.date} (${upcoming.hour || "N/A"})`
      : "📅 Próximo reporte: Sin fecha confirmada";

    fullMsg += `\n\n${epsBlock ? epsBlock + "\n" : ""}${analystSignal}\n${nextReport}`;
  }

  fullMsg += `\n\n✅ *${ticker}* agregado a tus favoritos`;

  const removeBtn = isEtf ? `remove_etf:${ticker}` : `remove_stock:${ticker}`;
  const replyMarkup = {
    inline_keyboard: [[{ text: "🗑️ Eliminar de favoritos", callback_data: removeBtn }]],
  };

  await sendMessageWithLogo(chatId, fullMsg, logoUrl, "Markdown", replyMarkup);
  return res.status(200).json({ ok: true });
}

async function handleMessage(res: VercelResponse, message: { chat: { id: number; first_name?: string }; text?: string }) {
  const chatId = String(message.chat.id);
  const text = (message.text || "").trim();

  if (text.startsWith("QUARTLY_ADD_STOCK:")) {
    const ticker = text.replace("QUARTLY_ADD_STOCK:", "");
    return handleAddFromInline(res, chatId, ticker, false);
  }

  if (text.startsWith("QUARTLY_ADD_ETF:")) {
    const ticker = text.replace("QUARTLY_ADD_ETF:", "");
    return handleAddFromInline(res, chatId, ticker, true);
  }

  if (text.startsWith("QUARTLY_ADD_CUSTOM:")) {
    const ticker = text.replace("QUARTLY_ADD_CUSTOM:", "");
    const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
    if (custom) {
      return handleAddFromInline(res, chatId, ticker, custom.isEtf);
    }
    return res.status(200).json({ ok: true });
  }

  const normalizedText = text.split("@")[0].trim();

  if (normalizedText === "/start") {
    await registerUser(chatId);
    const name = message.chat.first_name || "inversor";
    const welcome = `¡Hola ${name}! 👋 Soy *Quartly*, tu asistente de earnings e información financiera para el S\\&P 500 y ETFs\\.

📊 *¿Qué puedo hacer?*
• Rastrear empresas del S\\&P 500 y ETFs en tu watchlist
• Enviarte recordatorios antes de reportes de earnings
• Analizar resultados con IA cuando publican
• Ranking semanal de hype de earnings

🔍 *Cómo agregar activos:*
Escribe @QuartlyBot y el ticker o nombre de la empresa/ETF en cualquier chat\\. Selecciona el resultado para agregarlo a tu watchlist\\.

📋 *Comandos disponibles:*
/start — Bienvenida y cómo usar Quartly
/mystocks — Ver y eliminar acciones de tu watchlist
/myetfs — Ver y eliminar ETFs de tu watchlist
/report — Reporte manual de tus favoritos ahora`;
    await sendMessage(chatId, welcome);
    return res.status(200).json({ ok: true });
  }

  if (normalizedText === "/mystocks") {
    return handleMyStocks(res, chatId);
  }

  if (normalizedText === "/myetfs") {
    return handleMyEtfs(res, chatId);
  }

  if (normalizedText === "/report") {
    return handleReport(res, chatId);
  }

  return res.status(200).json({ ok: true });
}

async function handleMyStocks(res: VercelResponse, chatId: string) {
  const stocks = await getUserStocks(chatId);
  if (stocks.length === 0) {
    await sendMessage(chatId, "📋 No tienes acciones en tu watchlist\\. Usa @QuartlyBot para agregar\\.");
    return res.status(200).json({ ok: true });
  }

  let msg = "📋 *Tus acciones:*\\n\\n";
  for (const ticker of stocks) {
    const company = SP500.find((c) => c.ticker === ticker);
    const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
    const name = company ? company.name : custom ? custom.name : ticker;
    const sector = company ? company.sector : custom ? custom.sector : "";
    msg += `• *${ticker}* — ${name} (${sector})\n\\n`;
  }

  const inlineKeyboard = stocks.map((ticker) => ({ text: `🗑️ ${ticker}`, callback_data: `remove_stock:${ticker}` }));
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < inlineKeyboard.length; i += 2) {
    buttons.push(inlineKeyboard.slice(i, i + 2));
  }

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

  return res.status(200).json({ ok: true });
}

async function handleMyEtfs(res: VercelResponse, chatId: string) {
  const etfs = await getUserEtfs(chatId);
  if (etfs.length === 0) {
    await sendMessage(chatId, "📋 No tienes ETFs en tu watchlist\\. Usa @QuartlyBot para agregar\\.");
    return res.status(200).json({ ok: true });
  }

  let msg = "📋 *Tus ETFs:*\\n\\n";
  for (const ticker of etfs) {
    const etf = ETFS.find((e) => e.ticker === ticker);
    const name = etf ? etf.name : ticker;
    const category = etf ? etf.category : "";
    msg += `• *${ticker}* — ${name} (${category})\n\\n`;
  }

  const inlineKeyboard = etfs.map((ticker) => ({ text: `🗑️ ${ticker}`, callback_data: `remove_etf:${ticker}` }));
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < inlineKeyboard.length; i += 2) {
    buttons.push(inlineKeyboard.slice(i, i + 2));
  }

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

  return res.status(200).json({ ok: true });
}

async function handleReport(res: VercelResponse, chatId: string) {
  const { stocks, etfs } = await getUserWatchlist(chatId);
  const allTickers = [...stocks, ...etfs];

  if (allTickers.length === 0) {
    await sendMessage(chatId, "No tienes activos en tu watchlist\\. Usa @QuartlyBot para agregar\\.");
    return res.status(200).json({ ok: true });
  }

  const today = new Date().toISOString().split("T")[0];
  const calendar = await getEarningsCalendar(today, today);
  const reportingToday = calendar.filter((e) => allTickers.includes(e.symbol));

  if (reportingToday.length === 0) {
    for (const ticker of allTickers) {
      const isEtf = etfs.includes(ticker);
      const { name, sector } = resolveTickerInfo(ticker);
      const [recs, logoUrl, yahooData, quote] = await Promise.all([
        getRecommendationTrends(ticker),
        getLogoUrl(ticker, isEtf),
        getYahooPriceDataFull(ticker),
        getQuote(ticker),
      ]);

      const priceData: PriceData = {
        current: yahooData?.current ?? quote?.c ?? 0,
        change1d: yahooData?.change1d ?? quote?.dp ?? null,
        change1w: yahooData?.change1w ?? null,
        change1m: yahooData?.change1m ?? null,
        change3m: yahooData?.change3m ?? null,
        change1y: yahooData?.change1y ?? null,
        high52w: yahooData?.high52w ?? quote?.h ?? null,
        low52w: yahooData?.low52w ?? quote?.l ?? null,
      };

      const msg = formatPriceBlock(ticker, name, sector, priceData);
      const signal = formatAnalystSignal(recs);
      const fullMsg = `${msg}\n\n${signal}`;
      await sendMessageWithLogo(chatId, fullMsg, logoUrl);
    }
    return res.status(200).json({ ok: true });
  }

  for (const event of reportingToday) {
    const isEtf = etfs.includes(event.symbol);
    const { name, sector } = resolveTickerInfo(event.symbol);
    const logoUrl = await getLogoUrl(event.symbol, isEtf);

    const [history, recs, quote] = await Promise.all([
      isEtf ? Promise.resolve([]) : getEarningsHistory(event.symbol),
      getRecommendationTrends(event.symbol),
      getQuote(event.symbol),
    ]);

    const quota = await checkAndConsumeQuota(1);

    if (quota.allowed) {
      const companyData: CompanyData = {
        ticker: event.symbol,
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
      const analysis = report.favReports[event.symbol];
      if (analysis) {
        await sendMessageWithLogo(chatId, analysis, logoUrl);
      } else {
        const rawMsg = buildRawEarningsMessage(event, name, sector, quote, recs, history, isEtf);
        await sendMessageWithLogo(chatId, rawMsg, logoUrl);
      }
    } else {
      const rawMsg = buildRawEarningsMessage(event, name, sector, quote, recs, history, isEtf);
      await sendMessageWithLogo(chatId, rawMsg, logoUrl);
    }
  }

  const remaining = await getRemainingQuota();
  if (remaining <= 0) {
    await sendMessage(chatId, getQuotaExceededMessage());
  }

  return res.status(200).json({ ok: true });
}

function buildRawEarningsMessage(
  event: { symbol: string; name?: string; date: string; hour?: string; estimate: number; actual?: number | null; revenueEstimate?: number | null; surprisePercent?: number | null },
  name: string,
  sector: string,
  quote: { c: number; dp: number } | null,
  recs: unknown[],
  history: unknown[],
  isEtf: boolean
): string {
  const epsActual = event.actual !== null && event.actual !== undefined ? `$${event.actual.toFixed(2)}` : "N/A";
  const surprise = event.surprisePercent !== null && event.surprisePercent !== undefined
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
${epsBlock ? epsBlock + "\n" : ""}⚠️ Análisis con IA no disponible hoy\\. Límite alcanzado\\.`;
}
