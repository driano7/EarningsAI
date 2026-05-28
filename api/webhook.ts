/*
 * Quartly Bot — api/webhook.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { registerUser, getUserStocks, getUserEtfs, getUserWatchlist, getUserCryptos, removeStock, removeEtf, addStock, addEtf, addCrypto, removeCrypto } from "../lib/kv";
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
import { searchCrypto, getCryptoQuote, getCryptoHistory, formatCryptoBlock, CRYPTO_ID_MAP } from "../lib/coingecko";
import {
  addTransaction,
  getSummary,
  formatSummary,
  generateCSV,
} from "../lib/finance";
import {
  getFinanceTransactions,
  getUserCategories,
  setUserCategories,
  DEFAULT_CATEGORIES,
} from "../lib/kv";

const BOT_USERNAME = "@earningsinfoaibot";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "Quartly webhook is running" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  if (!body) return res.status(200).json({ ok: true });

  try {
    if (body.inline_query) {
      await handleInlineQuery(body.inline_query);
    } else if (body.chosen_inline_result) {
      await handleChosenInlineResult(body.chosen_inline_result);
    } else if (body.callback_query) {
      await handleCallback(body.callback_query);
    } else if (body.message) {
      await handleMessage(body.message, res);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return res.status(200).json({ ok: true });
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

  const cryptoResults = await searchCrypto(query.query);
  const cryptosToShow = cryptoResults
    .filter((c) => CRYPTO_ID_MAP[c.symbol.toUpperCase()])
    .slice(0, 10 - results.length);

  for (const c of cryptosToShow) {
    const ticker = c.symbol.toUpperCase();
    results.push({
      type: "article",
      id: `crypto_${ticker}`,
      title: `[${ticker}] ${c.name}`,
      description: `Crypto — Market Cap: $XXB`,
      input_message_content: { message_text: `QUARTLY_ADD_CRYPTO:${ticker}` },
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
  if (resultId.startsWith("crypto_")) {
    const ticker = resultId.replace("crypto_", "");
    return handleAddCryptoFromInline(chatId, ticker);
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
  } else if (action === "remove_crypto") {
    await removeCrypto(chatId, ticker);
    await sendMessage(chatId, `🗑️ *${ticker}* eliminado de tu watchlist de cryptos.`);
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

async function buildTickerCard(
  ticker: string,
  isEtf: boolean,
  upcomingCalendar: Array<{ symbol: string; date: string; hour?: string }>
): Promise<{ msg: string; logoUrl: string | null }> {
  const { name, sector } = resolveTickerInfo(ticker);

  const quote = await getQuote(ticker);
  await sleep(300);
  const recs = await getRecommendationTrends(ticker);
  await sleep(300);
  const history = isEtf ? [] : await getEarningsHistory(ticker);
  if (!isEtf) await sleep(300);
  const logoUrl = await getLogoUrl(ticker, isEtf);
  const yahooData = await getYahooPriceDataFull(ticker);

  const priceData: PriceData = {
    current: yahooData?.current ?? quote?.c ?? 0,
    change1d: yahooData?.change1d ?? (typeof quote?.dp === "number" ? quote.dp : null),
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
    const upcoming = upcomingCalendar.find((e) => e.symbol === ticker);
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

  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 90);
  const calendar = await getEarningsCalendar(today, future.toISOString().split("T")[0]);

  const { msg, logoUrl } = await buildTickerCard(ticker, isEtf, calendar);
  const fullMsg = msg + `\n\n✅ *${ticker}* agregado a tus favoritos`;

  const removeBtn = isEtf ? `remove_etf:${ticker}` : `remove_stock:${ticker}`;
  const replyMarkup = {
    inline_keyboard: [[{ text: "🗑️ Eliminar de favoritos", callback_data: removeBtn }]],
  };

  await sendMessageWithLogo(chatId, fullMsg, logoUrl, "Markdown", replyMarkup);
}

async function handleMessage(message: { chat: { id: number; first_name?: string }; text?: string }, res?: VercelResponse) {
  const chatId = String(message.chat.id);
  const text = (message.text || "").trim();

  if (text.startsWith("QUARTLY_ADD_CRYPTO:")) {
    const ticker = text.replace("QUARTLY_ADD_CRYPTO:", "");
    return handleAddCryptoFromInline(chatId, ticker);
  }

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
    const welcome = `¡Hola ${name}! 👋 Soy *Quartly*, tu asistente de earnings e información financiera para el S\\&P 500, ETFs, criptomonedas y finanzas personales\\.

 📊 *¿Qué puedo hacer?*
 • Rastrear empresas del S\\&P 500, ETFs y cryptos en tu watchlist
 • Enviarte recordatorios antes de reportes de earnings
 • Analizar resultados con IA cuando publican
 • Ranking semanal de hype de earnings
 • Precios y seguimiento de criptomonedas
 • Registrar ingresos, gastos e inversiones
 • Resumen mensual de finanzas personales

🔍 *Cómo agregar activos:*
Escribe ${BOT_USERNAME} y el ticker o nombre de la empresa/ETF/cripto en cualquier chat\\. Selecciona el resultado para agregarlo a tu watchlist\\.

📋 *Comandos disponibles:*
/start — Bienvenida y cómo usar Quartly
/mystocks — Ver y eliminar acciones de tu watchlist
/myetfs — Ver y eliminar ETFs de tu watchlist
/mycryptos — Ver y eliminar cryptos de tu watchlist
/report — Reporte manual de tus favoritos ahora
/income — Registrar ingreso: /income [cantidad] [categoría] [descripción]
/expense — Registrar gasto: /expense [cantidad] [categoría] [descripción]
/invest — Registrar inversión: /invest [cantidad] [ticker] [tipo]
/summary — Resumen mensual: /summary o /summary YYYY\\-MM
/categories — Ver y editar categorías
/export\\_csv — Exportar datos financieros a CSV`;
    await sendMessage(chatId, welcome);
    return;
  }

  if (cmd === "/mystocks") return handleMyStocks(chatId);
  if (cmd === "/myetfs") return handleMyEtfs(chatId);
  if (cmd === "/mycryptos") return handleMyCryptos(chatId);
  if (cmd === "/report") return handleReport(chatId);

  if (cmd.startsWith("/income ")) return handleFinanceCommand(res!, chatId, "income", text);
  if (cmd.startsWith("/expense ")) return handleFinanceCommand(res!, chatId, "expense", text);
  if (cmd.startsWith("/invest ")) return handleInvestCommand(res!, chatId, text);
  if (cmd.startsWith("/summary")) {
    const parts = text.split(" ");
    const mes = parts[1] || undefined;
    return handleSummaryCommand(res!, chatId, mes);
  }
  if (cmd.startsWith("/categories ")) return handleSubCategoriesCommand(res!, chatId, text);
  if (cmd === "/categories") return handleCategoriesCommand(res!, chatId);
  if (cmd === "/export_csv" || cmd === "/export") return handleExportCsvCommand(res!, chatId);
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

async function handleAddCryptoFromInline(chatId: string, ticker: string) {
  const result = await addCrypto(chatId, ticker);
  if (!result.ok && result.error) {
    await sendMessage(chatId, result.error);
    return;
  }

  const id = CRYPTO_ID_MAP[ticker];
  const name = id ? id.charAt(0).toUpperCase() + id.slice(1) : ticker;

  const [quote, history] = await Promise.all([
    getCryptoQuote(ticker),
    getCryptoHistory(ticker, 30),
  ]);

  let msg = quote ? formatCryptoBlock(ticker, name, quote) : `🪙 *${ticker}* — ${name}\nNo se pudieron obtener datos de precio.`;

  if (quote && history && history.prices.length > 0) {
    const firstPrice = history.prices[0][1];
    const lastPrice = history.prices[history.prices.length - 1][1];
    const change30d = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice * 100) : null;
    if (change30d !== null) {
      msg += `\n📆 Variación 30d: ${change30d >= 0 ? "+" : ""}${change30d.toFixed(2)}%`;
    }
  }

  msg += `\n\n✅ *${ticker}* agregado a tus cryptos favoritas`;

  const replyMarkup = {
    inline_keyboard: [[{ text: "🗑️ Eliminar de favoritos", callback_data: `remove_crypto:${ticker}` }]],
  };

  await sendMessage(chatId, msg, "Markdown", replyMarkup);
}

async function handleMyCryptos(chatId: string) {
  const cryptos = await getUserCryptos(chatId);
  if (cryptos.length === 0) {
    await sendMessage(chatId, `📋 No tienes cryptos en tu watchlist. Usa ${BOT_USERNAME} para agregar.`);
    return;
  }

  let msg = "🪙 *Tus cryptos:*\n\n";
  for (const ticker of cryptos) {
    const quote = await getCryptoQuote(ticker);
    if (quote) {
      const change = quote.change24h !== null
        ? `${quote.change24h >= 0 ? "+" : ""}${quote.change24h.toFixed(2)}%`
        : "N/A";
      msg += `• *${ticker}* — $${quote.priceUsd.toFixed(2)} (${change})\n`;
    } else {
      msg += `• *${ticker}* — Sin datos\n`;
    }
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  const kb = cryptos.map((t) => ({ text: `🗑️ ${t}`, callback_data: `remove_crypto:${t}` }));
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
  const cryptos = await getUserCryptos(chatId);
  const allTickers = [...stocks, ...etfs, ...cryptos];

  if (allTickers.length === 0) {
    await sendMessage(chatId, `No tienes activos en tu watchlist. Usa ${BOT_USERNAME} para agregar.`);
    return;
  }

  for (const ticker of cryptos) {
    const id = CRYPTO_ID_MAP[ticker];
    const name = id ? id.charAt(0).toUpperCase() + id.slice(1) : ticker;
    const [quote, history] = await Promise.all([
      getCryptoQuote(ticker),
      getCryptoHistory(ticker, 30),
    ]);

    let msg = quote ? formatCryptoBlock(ticker, name, quote) : `🪙 *${ticker}* — ${name}\nSin datos de precio.`;

    if (quote && history && history.prices.length > 0) {
      const firstPrice = history.prices[0][1];
      const lastPrice = history.prices[history.prices.length - 1][1];
      const change30d = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice * 100) : null;
      if (change30d !== null) {
        msg += `\n📆 Variación 30d: ${change30d >= 0 ? "+" : ""}${change30d.toFixed(2)}%`;
      }
    }

    const direction = quote && quote.change24h !== null
      ? (quote.change24h >= 0 ? "🟢 Tendencia alcista en 24h" : "🔴 Tendencia bajista en 24h")
      : "⚪ Sin datos de tendencia";
    msg += `\n${direction}`;
    await sendMessage(chatId, msg);
  }

  await sendMessage(chatId, `⏳ Generando reporte de ${allTickers.length} activos… llegará en unos segundos.`);

  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 90);

  const [todayCalendar, upcomingCalendar] = await Promise.all([
    getEarningsCalendar(today, today),
    getEarningsCalendar(today, future.toISOString().split("T")[0]),
  ]);

  const reportingTodaySymbols = new Set(
    todayCalendar.filter((e) => allTickers.includes(e.symbol)).map((e) => e.symbol)
  );

  // ─── Phase 1: collect CompanyData for ALL tickers reporting today ───────────
  const earningsDataMap = new Map<string, { companyData: CompanyData; logoUrl: string | null }>();

  for (const ticker of allTickers) {
    if (!reportingTodaySymbols.has(ticker)) continue;
    const isEtf = etfs.includes(ticker);
    const event = todayCalendar.find((e) => e.symbol === ticker)!;
    const { name, sector } = resolveTickerInfo(ticker);

    try {
      const logoUrl = await getLogoUrl(ticker, isEtf);
      const history = isEtf ? [] : await getEarningsHistory(ticker);
      await sleep(400);
      const recs = await getRecommendationTrends(ticker);
      await sleep(400);
      const quote = await getQuote(ticker);
      await sleep(400);

      const companyData: CompanyData = {
        ticker, name, sector,
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

      earningsDataMap.set(ticker, { companyData, logoUrl });
    } catch (err) {
      console.error(`Error fetching data for ${ticker}:`, err);
      await sendMessage(chatId, `⚠️ No se pudo cargar el reporte de *${ticker}*.`);
    }
  }

  // ─── Phase 2: single OpenRouter request for ALL reporting tickers ────────────
  let aiReports: Record<string, string> = {};

  if (earningsDataMap.size > 0) {
    const quota = await checkAndConsumeQuota(1);
    if (quota.allowed) {
      try {
        const allCompanyData = Array.from(earningsDataMap.values()).map((v) => v.companyData);
        const batchResult = await generateBatchReport({ favReports: allCompanyData, hypeRanking: null });
        aiReports = batchResult.favReports;
      } catch (err) {
        console.error("OpenRouter batch request failed:", err);
      }
    }
  }

  // ─── Phase 3: send one message per reporting ticker ──────────────────────────
  for (const [ticker, { companyData, logoUrl }] of earningsDataMap) {
    const analysis = aiReports[ticker];
    const isEtf = etfs.includes(ticker);

    if (analysis) {
      await sendMessageWithLogo(chatId, analysis, logoUrl);
    } else {
      const event = todayCalendar.find((e) => e.symbol === ticker)!;
      const rawMsg = buildRawEarningsMessage(
        event,
        companyData.name,
        companyData.sector,
        companyData.price !== null ? { c: companyData.price, dp: 0 } : null,
        [],
        [],
        isEtf
      );
      await sendMessageWithLogo(chatId, rawMsg, logoUrl);
    }

    await sleep(700);
  }

  // ─── Phase 4: non-reporting tickers (price cards) ────────────────────────────
  for (const ticker of allTickers) {
    if (reportingTodaySymbols.has(ticker)) continue;
    const isEtf = etfs.includes(ticker);

    try {
      const { msg, logoUrl } = await buildTickerCard(ticker, isEtf, upcomingCalendar);
      await sendMessageWithLogo(chatId, msg, logoUrl);
    } catch (err) {
      console.error(`Error building card for ${ticker}:`, err);
      await sendMessage(chatId, `⚠️ No se pudo cargar el reporte de *${ticker}*.`);
    }

    await sleep(700);
  }

  const remaining = await getRemainingQuota();
  if (remaining <= 0) {
    await sendMessage(chatId, getQuotaExceededMessage());
  }
}



async function handleFinanceCommand(res: VercelResponse, chatId: string, type: "income" | "expense", text: string) {
  const parts = parseFinanceArgs(text);
  if (!parts) {
    const cmdLabel = type === "income" ? "/income" : "/expense";
    const example = type === "income" ? '/income 15000 salario "Quincena enero"' : '/expense 450 comida "Cena restaurante"';
    await sendMessage(chatId, "❌ Formato incorrecto.\nUsa: *" + cmdLabel + " [cantidad] [categoría] [descripción]*\nEjemplo: " + example);
    return res.status(200).json({ ok: true });
  }

  const { amount, category, description } = parts;

  const categories = await getUserCategories(chatId);
  const validCats = type === "income" ? categories.income : categories.expense;
  if (!validCats.some((c) => c.toLowerCase() === category.toLowerCase())) {
    const catList = validCats.map((c) => "• " + c).join("\n");
    const typeLabel = type === "income" ? "ingresos" : "gastos";
    await sendMessage(chatId, "❌ Categoría no válida para " + typeLabel + ".\nCategorías disponibles:\n" + catList + "\n\nUsa /categories para personalizarlas.");
    return res.status(200).json({ ok: true });
  }

  const txn = await addTransaction(chatId, type, amount, category, description);
  const emoji = type === "income" ? "💰" : "💸";
  const label = type === "income" ? "Ingreso" : "Gasto";
  const msg = emoji + " *" + label + " registrado*\nCantidad: $" + txn.amount.toLocaleString() + "\nCategoría: " + txn.category + "\nDescripción: " + txn.description + "\nFecha: " + txn.date;
  await sendMessage(chatId, msg);
  return res.status(200).json({ ok: true });
}

async function handleInvestCommand(res: VercelResponse, chatId: string, text: string) {
  const parts = text.split(" ").filter(Boolean);
  if (parts.length < 3) {
    await sendMessage(chatId, "❌ Formato incorrecto.\nUsa: */invest [cantidad] [ticker] [tipo]*\nTipos: stock, etf, crypto\nEjemplo: /invest 5000 AAPL stock");
    return res.status(200).json({ ok: true });
  }

  const amount = parseFloat(parts[1].replace(",", ""));
  const ticker = parts[2].toUpperCase();
  const tipo = parts[3]?.toLowerCase() || "stock";

  if (isNaN(amount) || amount <= 0) {
    await sendMessage(chatId, "❌ Cantidad inválida.");
    return res.status(200).json({ ok: true });
  }

  await addTransaction(chatId, "invest", amount, tipo === "crypto" ? "Crypto" : "Stock/ETF", `${ticker}`);

  if (tipo === "crypto") {
    const result = await addCrypto(chatId, ticker);
    if (!result.ok && result.error) {
      await sendMessage(chatId, result.error);
      return res.status(200).json({ ok: true });
    }
  } else {
    const isEtf = tipo === "etf";
    const result = isEtf ? await addEtf(chatId, ticker) : await addStock(chatId, ticker);
    if (!result.ok && result.error) {
      await sendMessage(chatId, result.error);
      return res.status(200).json({ ok: true });
    }
  }

  const investMsg = "📈 *Inversión registrada*\nCantidad: $" + amount.toLocaleString() + "\nActivo: " + ticker + " (" + tipo + ")\n✅ Agregado a tu watchlist de " + (tipo === "crypto" ? "cryptos" : "acciones") + ".";
  await sendMessage(chatId, investMsg);
  return res.status(200).json({ ok: true });
}

async function handleSummaryCommand(res: VercelResponse, chatId: string, mes?: string) {
  if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
    await sendMessage(chatId, "❌ Formato de mes inválido. Usa YYYY-MM, ej: /summary 2026-04");
    return res.status(200).json({ ok: true });
  }

  const summary = await getSummary(chatId, mes);
  if (!summary) {
    await sendMessage(chatId, "📭 No hay datos financieros para este mes.\nComienza registrando con /income, /expense o /invest.");
    return res.status(200).json({ ok: true });
  }

  await sendMessage(chatId, formatSummary(summary));
  return res.status(200).json({ ok: true });
}

async function handleCategoriesCommand(res: VercelResponse, chatId: string) {
  const cats = await getUserCategories(chatId);
  const incomeList = cats.income.map((c) => `• ${c}`).join("\n");
  const expenseList = cats.expense.map((c) => `• ${c}`).join("\n");

  await sendMessage(chatId, `📂 *Tus categorías*

💰 *Ingresos:*
${incomeList}

💸 *Gastos:*
${expenseList}

Para personalizar, escribe /categories add income|expense [nombre]
Para eliminar: /categories remove income|expense [nombre]
Para resetear: /categories reset

Ejemplo: /categories add expense "Suscripciones"`);
  return res.status(200).json({ ok: true });
}

async function handleSubCategoriesCommand(res: VercelResponse, chatId: string, text: string) {
  const parts = text.split(" ").filter(Boolean);
  if (parts.length < 4) {
    return handleCategoriesCommand(res, chatId);
  }

  const subCmd = parts[1].toLowerCase();
  const type = parts[2].toLowerCase() as "income" | "expense";
  if (type !== "income" && type !== "expense") {
    await sendMessage(chatId, "❌ Tipo inválido. Usa income o expense.");
    return res.status(200).json({ ok: true });
  }

  const catName = parts.slice(3).join(" ").replace(/"/g, "").trim();
  if (!catName) {
    await sendMessage(chatId, "❌ Nombre de categoría vacío.");
    return res.status(200).json({ ok: true });
  }

  const cats = await getUserCategories(chatId);

  if (subCmd === "add") {
    if (cats[type].some((c) => c.toLowerCase() === catName.toLowerCase())) {
      await sendMessage(chatId, `⚠️ La categoría "${catName}" ya existe en ${type}.`);
      return res.status(200).json({ ok: true });
    }
    cats[type].push(catName);
    await setUserCategories(chatId, cats);
    await sendMessage(chatId, `✅ Categoría "${catName}" agregada a ${type === "income" ? "ingresos" : "gastos"}.`);
  } else if (subCmd === "remove") {
    const idx = cats[type].findIndex((c) => c.toLowerCase() === catName.toLowerCase());
    if (idx === -1) {
      await sendMessage(chatId, `❌ Categoría "${catName}" no encontrada en ${type}.`);
      return res.status(200).json({ ok: true });
    }
    cats[type].splice(idx, 1);
    await setUserCategories(chatId, cats);
    await sendMessage(chatId, `🗑️ Categoría "${catName}" eliminada de ${type === "income" ? "ingresos" : "gastos"}.`);
  } else if (subCmd === "reset") {
    await setUserCategories(chatId, DEFAULT_CATEGORIES);
    await sendMessage(chatId, "🔄 Categorías restauradas a valores por defecto.");
  } else {
    await handleCategoriesCommand(res, chatId);
  }

  return res.status(200).json({ ok: true });
}

async function handleExportCsvCommand(res: VercelResponse, chatId: string) {
  const txns = await getFinanceTransactions(chatId);
  if (txns.length === 0) {
    await sendMessage(chatId, "📭 No hay datos financieros para exportar.");
    return res.status(200).json({ ok: true });
  }

  if (txns.length <= 30) {
    const csv = generateCSV(chatId, txns);
    await sendMessage(chatId, `📊 *Exportación CSV*\n\`\`\`\n${csv}\n\`\`\``);
    return res.status(200).json({ ok: true });
  }

  const csv = generateCSV(chatId, txns);
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", new Blob([csv], { type: "text/csv" }), `quartly_finanzas_${new Date().toISOString().slice(0, 10)}.csv`);
  formData.append("caption", `📊 Exportación de finanzas - ${txns.length} transacciones`);

  await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  return res.status(200).json({ ok: true });
}

function parseFinanceArgs(text: string): { amount: number; category: string; description: string } | null {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const ch of text) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === " " && !inQuotes) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);

  if (parts.length < 3) return null;
  const amount = parseFloat(parts[1].replace(",", ""));
  if (isNaN(amount) || amount <= 0) return null;
  return {
    amount,
    category: parts[2],
    description: parts.slice(3).join(" ") || parts[2],
  };
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
EPS Est: $${event.estimate != null ? event.estimate.toFixed(2) : 'N/A'} | EPS Real: ${epsActual}
Surprise: ${surprise}
${priceText}
${signal}
${epsBlock ? epsBlock + "\n" : ""}⚠️ Análisis con IA no disponible. Límite alcanzado.`;
}
