/*
 * Quartly Bot — lib/chatbot-batch.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { kv } from "@vercel/kv";
import { getUserStocks, getUserEtfs } from "@/lib/kv";
import { getPositions } from "@/lib/kv-portfolio";
import {
  getEarningsCalendar, getEarningsHistory, getRecommendationTrends,
  getQuote, formatEPSBlock, formatAnalystSignal,
} from "@/lib/finnhub";
import { getSummary } from "@/lib/finance";
import { generateBatchReport, type CompanyData, type HypeRanking } from "@/lib/openrouter";
import { checkAndConsumeQuota, getRemainingQuota } from "@/lib/quota";
import { buildHypeRanking } from "@/lib/hype";

export type ChatPreset = "reporte" | "resumen" | "portafolio" | "hype" | "agregar";

export interface PrebuiltPack {
  reporte: string;
  resumen: string;
  portafolio: string;
  hype: string;
  generatedAt: number;
  aiFailed?: boolean;
}

export interface PrebuiltResult {
  reply: string;
  quotaRemaining: number;
  quotaExhausted: boolean;
  fromCache: boolean;
}

export const LOW_QUOTA_THRESHOLD = 3;

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function secondsUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(24, 0, 0, 0);
  return Math.max(Math.floor((end.getTime() - now.getTime()) / 1000), 60);
}

export function getPresetReplyMessage(preset: ChatPreset): string {
  switch (preset) {
    case "reporte":
      return "Dame el reporte de earnings de mis acciones";
    case "resumen":
      return "Dame el resumen de mis finanzas de este mes";
    case "portafolio":
      return "Muéstrame mi portafolio con P&L actual";
    case "hype":
      return "Qué acciones tienen más hype esta semana";
    case "agregar":
      return "Quiero agregar un valor a mi watchlist";
  }
}

async function loadPrebuilt(chatId: string): Promise<PrebuiltPack | null> {
  try {
    return await kv.get<PrebuiltPack>(`chatbot:prebuilt:${chatId}:${todayStr()}`);
  } catch {
    return null;
  }
}

async function savePrebuilt(chatId: string, pack: PrebuiltPack): Promise<void> {
  await kv.set(`chatbot:prebuilt:${chatId}:${todayStr()}`, pack, {
    ex: secondsUntilEndOfDay(),
  });
}

async function buildResumenMessage(chatId: string): Promise<string> {
  const summary = await getSummary(chatId).catch(() => null);
  if (!summary) {
    return "No hay datos financieros para este mes. Registra ingresos y gastos usando la sección Gastos.";
  }
  const topCat = summary.porCategoria.slice(0, 3);
  const catText = topCat.length > 0
    ? `\n\nPrincipales categorías:\n${topCat.map((c) => `• ${c.categoria}: $${c.total.toFixed(2)} (${c.porcentaje.toFixed(1)}%)`).join("\n")}`
    : "";
  return `📊 Resumen Financiero\n\n💰 Ingresos: $${summary.ingresos.toFixed(2)}\n💸 Gastos: $${summary.gastos.toFixed(2)}\n📈 Inversiones: $${summary.inversiones.toFixed(2)}\n💵 Balance: $${summary.balance.toFixed(2)}${catText}`;
}

async function buildPortafolioMessage(chatId: string): Promise<string> {
  const positions = await getPositions(chatId).catch(() => []);
  if (positions.length === 0) {
    return "No tienes posiciones en tu portafolio. Agrega desde la sección Portafolio.";
  }

  const rows: string[] = [];
  let totalPnl = 0;
  for (const pos of positions) {
    const quote = await getQuote(pos.ticker).catch(() => null);
    const currentPrice = quote?.c ?? null;
    const pnl = currentPrice !== null ? ((currentPrice - pos.buyPrice) / pos.buyPrice * 100) : null;
    if (pnl !== null) totalPnl += pnl;
    const emoji = pnl !== null ? (pnl >= 0 ? "🟢" : "🔴") : "⚪";
    rows.push(`${emoji} *${pos.ticker}* (${pos.type}) — Compra: $${pos.buyPrice} | Actual: $${currentPrice?.toFixed(2) ?? "N/A"} | P&L: ${pnl !== null ? pnl.toFixed(2) + "%" : "N/A"} | Qty: ${pos.quantity}`);
  }

  const avgPnl = (totalPnl / positions.length).toFixed(2);
  return `📈 *Tu Portafolio (${positions.length} posiciones)*\n\n${rows.join("\n")}\n\n📊 P&L Promedio: ${avgPnl}%`;
}

const QUOTA_EXHAUSTED_MSG = "⚠️ Cuota diaria de análisis agotada. Se resetea a las 00:00 UTC.";
const NO_HYPE_MSG = "No hay datos de hype disponibles esta semana.";
const AI_FAILURE_MSG = "No se pudo generar el reporte.";

async function buildReporteHypeMessages(chatId: string): Promise<{ reporte: string; hype: string; aiFailed: boolean }> {
  const [stocks, etfs] = await Promise.all([
    getUserStocks(chatId).catch(() => [] as string[]),
    getUserEtfs(chatId).catch(() => [] as string[]),
  ]);
  const userTickers = [...stocks, ...etfs];

  const today = new Date().toISOString().split("T")[0];
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [calendar, hype] = await Promise.all([
    getEarningsCalendar(today, future).catch(() => []),
    buildHypeRanking().catch(() => null),
  ]);

  const userEvents = userTickers.length > 0
    ? calendar.filter((e) => userTickers.includes(e.symbol))
    : [];

  if (userEvents.length === 0 && (!hype || !hype.top5 || hype.top5.length === 0)) {
    return {
      reporte: userTickers.length === 0
        ? "No tienes acciones o ETFs en tu watchlist. Agrega tickers desde la sección Favoritos."
        : `No hay earnings reportados en los próximos 14 días para tus tickers (${userTickers.join(", ")}).`,
      hype: NO_HYPE_MSG,
      aiFailed: false,
    };
  }

  if (userEvents.length > 0) {
    const { allowed } = await checkAndConsumeQuota(Math.min(userEvents.length, 5));
    if (!allowed) {
      return { reporte: "LO_QUOTA_EXHAUSTED", hype: "LO_QUOTA_EXHAUSTED", aiFailed: false };
    }
  } else if (hype && hype.top5 && hype.top5.length > 0) {
    const { allowed } = await checkAndConsumeQuota(3);
    if (!allowed) {
      return { reporte: "LO_QUOTA_EXHAUSTED", hype: "LO_QUOTA_EXHAUSTED", aiFailed: false };
    }
  }

  let reporte: string;
  let hypeMsg: string;
  let aiFailed = false;

  if (userEvents.length > 0) {
    const batchSize = Math.min(userEvents.length, 5);
    const companyDataArray: CompanyData[] = await Promise.all(
      userEvents.slice(0, batchSize).map(async (ev) => {
        const [history, recs, quote] = await Promise.all([
          getEarningsHistory(ev.symbol).catch(() => []),
          getRecommendationTrends(ev.symbol).catch(() => []),
          getQuote(ev.symbol).catch(() => null),
        ]);
        return {
          ticker: ev.symbol,
          name: ev.name || ev.symbol,
          sector: "",
          date: ev.date,
          hour: ev.hour || "N/A",
          epsEstimate: ev.estimate ?? 0,
          epsActual: ev.actual ?? null,
          revenueEstimate: ev.revenueEstimate ?? null,
          surprisePercent: ev.surprisePercent ?? null,
          price: quote?.c ?? null,
          analystSignal: formatAnalystSignal(recs),
          epsHistory: formatEPSBlock(history),
        };
      })
    );

    let report;
    try {
      report = await generateBatchReport({
        favReports: companyDataArray,
        hypeRanking: hype as HypeRanking | null,
      });
    } catch (err) {
      console.error("[chatbot-batch] generateBatchReport failed:", err);
      report = { favReports: {}, hypeMessage: null };
      aiFailed = true;
    }
    reporte = Object.values(report.favReports).join("\n\n") || AI_FAILURE_MSG;
    hypeMsg = report.hypeMessage || NO_HYPE_MSG;
  } else {
    reporte = userTickers.length === 0
      ? "No tienes acciones o ETFs en tu watchlist. Agrega tickers desde la sección Favoritos."
      : `No hay earnings reportados en los próximos 14 días para tus tickers (${userTickers.join(", ")}).`;
    hypeMsg = NO_HYPE_MSG;
  }

  return { reporte, hype: hypeMsg, aiFailed };
}

function applyQuotaGuard(message: string): string {
  return message === "LO_QUOTA_EXHAUSTED" ? QUOTA_EXHAUSTED_MSG : message;
}

export async function getPrebuilt(chatId: string, preset: Exclude<ChatPreset, "agregar">): Promise<PrebuiltResult> {
  const cached = await loadPrebuilt(chatId);
  if (cached && !cached.aiFailed) {
    const remaining = await getRemainingQuota();
    return {
      reply: applyQuotaGuard(cached[preset]),
      quotaRemaining: remaining,
      quotaExhausted: remaining <= 0,
      fromCache: true,
    };
  }

  const [resumen, portafolio] = await Promise.all([
    buildResumenMessage(chatId),
    buildPortafolioMessage(chatId),
  ]);
  const { reporte, hype, aiFailed } = await buildReporteHypeMessages(chatId);

  const pack: PrebuiltPack = {
    reporte,
    resumen,
    portafolio,
    hype,
    generatedAt: Date.now(),
    aiFailed,
  };
  await savePrebuilt(chatId, pack);

  const remaining = await getRemainingQuota();
  return {
    reply: applyQuotaGuard(pack[preset]),
    quotaRemaining: remaining,
    quotaExhausted: remaining <= 0,
    fromCache: false,
  };
}