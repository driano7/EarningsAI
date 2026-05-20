import type { VercelRequest, VercelResponse } from "@vercel/node";
import { registerUser, getUserStocks, getUserEtfs, getUserWatchlist, removeStock, removeEtf, addStock, addEtf } from "../lib/kv";
import { SP500 } from "../lib/sp500";
import { ETFS } from "../lib/etfs";
import { getEarningsCalendar, getEarningsHistory, getRecommendationTrends, getQuote, formatEPSBlock, formatAnalystSignal } from "../lib/finnhub";
import { getLogoUrl } from "../lib/logo";
import { sendMessageWithLogo, sendMessage, answerInlineQuery } from "../lib/telegram";
import { checkAndConsumeQuota, getQuotaExceededMessage } from "../lib/quota";
import { generateBatchReport, CompanyData } from "../lib/openrouter";
import { formatPriceBlock, PriceData } from "../lib/price";

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

  if (body.inline_query) {
    return handleInlineQuery(res, body.inline_query);
  }

  if (body.chosen_inline_result) {
    return handleChosenInlineResult(res, body.chosen_inline_result);
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

// chosen_inline_result: fired when the user picks a result from the inline query.
// from.id is always the user's Telegram ID — use it as chatId so the response
// goes to the bot's private chat with the user, regardless of which chat they
// triggered the inline from.
async function handleChosenInlineResult(
  res: VercelResponse,
  chosen: { result_id: string; from: { id: number }; query: string }
) {
  const chatId = String(chosen.from.id);
  const resultId = chosen.result_id; // e.g. "stock_AAPL" or "etf_QQQ"

  // Ensure the user is registered so addStock/addEtf can work
  await registerUser(chatId);

  if (resultId.startsWith("stock_")) {
    const ticker = resultId.replace("stock_", "");
    return handleAddFromInline(res, chatId, ticker, false);
  }

  if (resultId.startsWith("etf_")) {
    const ticker = resultId.replace("etf_", "");
    return handleAddFromInline(res, chatId, ticker, true);
  }

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

async function handleAddFromInline(res: VercelResponse, chatId: string, ticker: string, isEtf: boolean) {
  const result = isEtf ? await addEtf(chatId, ticker) : await addStock(chatId, ticker);

  if (!result.ok && result.error) {
    await sendMessage(chatId, result.error);
    return res.status(200).json({ ok: true });
  }

  const spCompany = SP500.find((c) => c.ticker === ticker);
  const etfObj = ETFS.find((e) => e.ticker === ticker);
  const name = spCompany?.name || etfObj?.name || ticker;
  const sectorOrCategory = spCompany?.sector || etfObj?.category || "";

  const [quote, recs, history, logoUrl] = await Promise.all([
    getQuote(ticker),
    getRecommendationTrends(ticker),
    isEtf ? Promise.resolve([]) : getEarningsHistory(ticker),
    getLogoUrl(ticker, isEtf),
  ]);

  let msg = "";

  if (quote) {
    const priceData: PriceData = {
      current: quote.c,
      change1d: quote.dp,
      change1w: null,
      change1m: null,
      change3m: null,
      change1y: null,
      high52w: quote.h,
      low52w: quote.l,
    };
    msg = formatPriceBlock(ticker, name, sectorOrCategory, priceData);
  } else {
    msg = `💹 *${ticker}* — ${name} (${sectorOrCategory})`;
  }

  const epsBlock = isEtf ? "" : formatEPSBlock(history);
  const analystSignal = formatAnalystSignal(recs);

  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const calendar = await getEarningsCalendar(today, future.toISOString().split("T")[0]);
  const upcoming = calendar.find((e) => e.symbol === ticker);
  const nextReport = upcoming ? `📅 Próximo reporte estimado: ${upcoming.date} (${upcoming.hour || "N/A"})` : "📅 Próximo reporte: Sin fecha confirmada";

  const fullMsg = `${msg}\n\n${epsBlock ? epsBlock + "\n" : ""}${analystSignal}\n${nextReport}\n\n✅ *${ticker}* agregado a tus favoritos`;

  await sendMessageWithLogo(chatId, fullMsg, logoUrl);
  return res.status(200).json({ ok: true });
}

async function handleMessage(res: VercelResponse, message: { chat: { id: number; first_name?: string }; text?: string }) {
  const chatId = String(message.chat.id);
  const text = (message.text || "").trim();

  // Fallback: handle QUARTLY_ADD_* messages that arrive as regular messages
  // (e.g. when the inline is used inside the bot's own chat)
  if (text.startsWith("QUARTLY_ADD_STOCK:")) {
    const ticker = text.replace("QUARTLY_ADD_STOCK:", "");
    return handleAddFromInline(res, chatId, ticker, false);
  }

  if (text.startsWith("QUARTLY_ADD_ETF:")) {
    const ticker = text.replace("QUARTLY_ADD_ETF:", "");
    return handleAddFromInline(res, chatId, ticker, true);
  }

  if (text === "/start") {
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
/report — Reporte manual de tus favoritos ahora`;
    await sendMessage(chatId, welcome);
    return res.status(200).json({ ok: true });
  }

  if (text === "/mystocks") {
    return handleMyStocks(res, chatId);
  }

  if (text === "/myetfs") {
    return handleMyEtfs(res, chatId);
  }

  if (text === "/report") {
    return handleReport(res, chatId);
  }

  return res.status(200).json({ ok: true });
}

async function handleMyStocks(res: VercelResponse, chatId: string) {
  const stocks = await getUserStocks(chatId);
  if (stocks.length === 0) {
    await sendMessage(chatId, `📋 No tienes acciones en tu watchlist\\. Usa ${BOT_USERNAME} para agregar\\.`);
    return res.status(200).json({ ok: true });
  }

  let msg = "📋 *Tus acciones:*\n\n";
  for (const ticker of stocks) {
    const company = SP500.find((c) => c.ticker === ticker);
    const name = company ? company.name : ticker;
    const sector = company ? company.sector : "";
    msg += `• *${ticker}* — ${name} (${sector})\n`;
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
    await sendMessage(chatId, `📋 No tienes ETFs en tu watchlist\\. Usa ${BOT_USERNAME} para agregar\\.`);
    return res.status(200).json({ ok: true });
  }

  let msg = "📋 *Tus ETFs:*\n\n";
  for (const ticker of etfs) {
    const etf = ETFS.find((e) => e.ticker === ticker);
    const name = etf ? etf.name : ticker;
    const category = etf ? etf.category : "";
    msg += `• *${ticker}* — ${name} (${category})\n`;
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
    await sendMessage(chatId, `No tienes activos en tu watchlist\\. Usa ${BOT_USERNAME} para agregar\\.`);
    return res.status(200).json({ ok: true });
  }

  const today = new Date().toISOString().split("T")[0];
  const calendar = await getEarningsCalendar(today, today);
  const reportingToday = calendar.filter((e) => allTickers.includes(e.symbol));

  if (reportingToday.length === 0) {
    await sendMessage(chatId, "📋 Ninguno de tus activos reporta earnings hoy\\. Te avisaré cuando lo hagan\\.");
    return res.status(200).json({ ok: true });
  }

  const quota = await checkAndConsumeQuota(1);

  if (!quota.allowed) {
    for (const event of reportingToday) {
      const [quote, recs] = await Promise.all([getQuote(event.symbol), getRecommendationTrends(event.symbol)]);
      const logoUrl = await getLogoUrl(event.symbol, etfs.includes(event.symbol));
      const priceText = quote ? `Precio: $${quote.c.toFixed(2)} (${quote.dp >= 0 ? "+" : ""}${quote.dp.toFixed(2)}%)` : "Precio: N/A";
      const signal = formatAnalystSignal(recs);
      const rawMsg = `📊 *${event.symbol}* — ${event.name || event.symbol}
Fecha: ${event.date} (${event.hour || "N/A"})
EPS Est: $${event.estimate.toFixed(2)}
${priceText}
${signal}
⚠️ Análisis con IA no disponible hoy\\. Límite alcanzado\\.`;
      await sendMessageWithLogo(chatId, rawMsg, logoUrl);
    }
    await sendMessage(chatId, getQuotaExceededMessage());
    return res.status(200).json({ ok: true });
  }

  const companyDataList: CompanyData[] = [];
  for (const event of reportingToday) {
    const isEtf = etfs.includes(event.symbol);
    const spCompany = SP500.find((c) => c.ticker === event.symbol);
    const etfObj = ETFS.find((e) => e.ticker === event.symbol);
    const name = spCompany?.name || etfObj?.name || event.name || event.symbol;
    const sector = spCompany?.sector || etfObj?.category || "";

    const [history, recs, quote] = await Promise.all([
      isEtf ? Promise.resolve([]) : getEarningsHistory(event.symbol),
      getRecommendationTrends(event.symbol),
      getQuote(event.symbol),
    ]);

    companyDataList.push({
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
    });
  }

  const report = await generateBatchReport({ favReports: companyDataList, hypeRanking: null });

  for (const data of companyDataList) {
    const analysis = report.favReports[data.ticker];
    const logoUrl = await getLogoUrl(data.ticker, etfs.includes(data.ticker));
    if (analysis) {
      await sendMessageWithLogo(chatId, analysis, logoUrl);
    }
  }

  return res.status(200).json({ ok: true });
}
