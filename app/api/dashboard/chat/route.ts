import { NextRequest, NextResponse } from "next/server";
import { getUserStocks, getUserEtfs, getUserCryptos, getFinanceTransactions } from "@/lib/kv";
import { getPositions } from "@/lib/kv-portfolio";
import {
  getEarningsCalendar, getEarningsHistory, getRecommendationTrends,
  getQuote, formatEPSBlock, formatAnalystSignal,
} from "@/lib/finnhub";
import { getSummary } from "@/lib/finance";
import { getPriceVariations } from "@/lib/price-variations";
import { generateBatchReport } from "@/lib/openrouter";
import { checkAndConsumeQuota } from "@/lib/quota";
import { buildHypeRanking } from "@/lib/hype";
import { getCryptoQuote } from "@/lib/coingecko";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const QUOTA_MSG = "⚠️ Cuota diaria de análisis agotada. Se resetea a las 00:00 UTC.";

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "ADA", "DOT", "AVAX", "MATIC", "LINK", "UNI", "ATOM", "XRP", "BNB", "DOGE", "LTC", "TRX", "NEAR", "APT", "ARB", "OP", "SUI", "INJ", "TIA", "SEI", "FET", "RNDR", "FIL", "ICP", "HBAR", "VET", "ALGO", "FTM", "EOS", "ZIL", "THETA", "GRT", "ENJ", "SAND", "MANA", "AXS", "AAVE", "MKR", "COMP", "YFI", "SNX", "SUSHI", "CRV", "BAL", "CAKE", "RUNE"]);

function parseTicker(message: string): string | null {
  const match = message.match(/\b([A-Z]{1,5})\b/);
  return match ? match[1].toUpperCase() : null;
}

async function buildUserContext(chatId: string): Promise<string> {
  const [stocks, etfs, cryptos, summary] = await Promise.all([
    getUserStocks(chatId).catch(() => []),
    getUserEtfs(chatId).catch(() => []),
    getUserCryptos(chatId).catch(() => []),
    getSummary(chatId).catch(() => null),
  ]);
  const parts: string[] = [];
  if (stocks.length > 0) parts.push(`Acciones: ${stocks.join(", ")}`);
  if (etfs.length > 0) parts.push(`ETFs: ${etfs.join(", ")}`);
  if (cryptos.length > 0) parts.push(`Cryptos: ${cryptos.join(", ")}`);
  if (summary) {
    parts.push(`Resumen del mes: ingresos $${summary.ingresos}, gastos $${summary.gastos}, inversiones $${summary.inversiones}, balance $${summary.balance}`);
  }
  return parts.length > 0 ? parts.join("\n") : "Sin watchlist configurada.";
}

export async function POST(req: NextRequest) {
  try {
    const { message, chatId, history } = (await req.json()) as {
      message: string;
      chatId: string;
      history: ChatMessage[];
    };

    if (!chatId || !message) {
      return NextResponse.json({ reply: "Faltan datos." }, { status: 200 });
    }

    const lower = message.toLowerCase();

    /* ── A) EARNINGS / REPORT ─────────────────────────────────── */
    if (lower.includes("reporte") || lower.includes("earnings") || lower.includes("report") || lower.includes("cuándo reporta") || lower.includes("cuando reporta")) {
      const [stocks, etfs] = await Promise.all([
        getUserStocks(chatId).catch(() => [] as string[]),
        getUserEtfs(chatId).catch(() => [] as string[]),
      ]);
      const userTickers = [...stocks, ...etfs];
      if (userTickers.length === 0) {
        return NextResponse.json({ reply: "No tienes acciones o ETFs en tu watchlist. Agrega tickers desde la sección Favoritos." });
      }

      const today = new Date().toISOString().split("T")[0];
      const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const calendar = await getEarningsCalendar(today, future);
      const userEvents = calendar.filter((e) => userTickers.includes(e.symbol));

      if (userEvents.length === 0) {
        return NextResponse.json({ reply: `No hay earnings reportados en los próximos 14 días para tus tickers (${userTickers.join(", ")}).` });
      }

      const batchSize = Math.min(userEvents.length, 5);
      const { allowed } = await checkAndConsumeQuota(batchSize);
      if (!allowed) {
        return NextResponse.json({ reply: QUOTA_MSG });
      }

      const companyDataArray = await Promise.all(
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
            epsEstimate: ev.estimate,
            epsActual: ev.actual ?? null,
            revenueEstimate: ev.revenueEstimate ?? null,
            surprisePercent: ev.surprisePercent ?? null,
            price: quote?.c ?? null,
            analystSignal: formatAnalystSignal(recs),
            epsHistory: formatEPSBlock(history),
          };
        })
      );

      const report = await generateBatchReport({ favReports: companyDataArray, hypeRanking: null });
      const reply = Object.values(report.favReports).join("\n\n");
      return NextResponse.json({ reply: reply || "No se pudo generar el reporte." });
    }

    /* ── B) SUMMARY / FINANZAS ─────────────────────────────────── */
    if (lower.includes("resumen") || lower.includes("summary") || lower.includes("mis finanzas") || lower.includes("balance") || lower.includes("cuánto gasté") || lower.includes("cuanto gaste")) {
      const summary = await getSummary(chatId);
      if (!summary) {
        return NextResponse.json({ reply: "No hay datos financieros para este mes. Registra ingresos y gastos usando la sección Gastos." });
      }
      const topCat = summary.porCategoria.slice(0, 3);
      const catText = topCat.length > 0
        ? `\n\nPrincipales categorías:\n${topCat.map((c) => `• ${c.categoria}: $${c.total.toFixed(2)} (${c.porcentaje.toFixed(1)}%)`).join("\n")}`
        : "";
      return NextResponse.json({
        reply: `📊 Resumen Financiero\n\n💰 Ingresos: $${summary.ingresos.toFixed(2)}\n💸 Gastos: $${summary.gastos.toFixed(2)}\n📈 Inversiones: $${summary.inversiones.toFixed(2)}\n💵 Balance: $${summary.balance.toFixed(2)}${catText}`,
      });
    }

    /* ── C) PORTFOLIO ─────────────────────────────────────────── */
    if (lower.includes("portafolio") || lower.includes("mis acciones") || lower.includes("posiciones") || lower.includes("p&l") || lower.includes("ganancia")) {
      const positions = await getPositions(chatId).catch(() => []);
      if (positions.length === 0) {
        return NextResponse.json({ reply: "No tienes posiciones en tu portafolio. Agrega desde la sección Portafolio." });
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
      return NextResponse.json({
        reply: `📈 *Tu Portafolio (${positions.length} posiciones)*\n\n${rows.join("\n")}\n\n📊 P&L Promedio: ${avgPnl}%`,
      });
    }

    /* ── D) HYPE RANKING ──────────────────────────────────────── */
    if (lower.includes("hype") || lower.includes("qué comprar") || lower.includes("que comprar") || lower.includes("ranking") || lower.includes("top acciones")) {
      const { allowed } = await checkAndConsumeQuota(3);
      if (!allowed) {
        return NextResponse.json({ reply: QUOTA_MSG });
      }
      const hype = await buildHypeRanking();
      if (!hype || !hype.top5 || hype.top5.length === 0) {
        return NextResponse.json({ reply: "No hay datos de hype disponibles esta semana." });
      }
      const top = hype.top5.map((h, i) => `${i + 1}. *${h.ticker}* — ${h.name} — Score: ${h.hypeScore}/100`).join("\n");
      const bottom = hype.bottom5.map((h, i) => `${i + 1}. *${h.ticker}* — ${h.name} — Score: ${h.hypeScore}/100`).join("\n");
      return NextResponse.json({
        reply: `🔥 *Top 5 Hype de la Semana*\n${top}\n\n📉 *Bottom 5*\n${bottom}`,
      });
    }

    /* ── E) PRICE ─────────────────────────────────────────────── */
    const priceMatch = message.match(/precio\s+(?:de\s+)?([A-Z]{1,5})/i);
    if (priceMatch) {
      const ticker = priceMatch[1].toUpperCase();
      const quote = await getQuote(ticker);
      if (!quote) {
        return NextResponse.json({ reply: `No se encontró precio para *${ticker}*. Verifica el ticker.` });
      }
      const sign = quote.dp >= 0 ? "+" : "";
      return NextResponse.json({
        reply: `📊 *${ticker}*\n💵 Precio: $${quote.c.toFixed(2)}\n📈 Cambio: ${sign}${quote.d.toFixed(2)} (${sign}${quote.dp.toFixed(2)}%)`,
      });
    }

    /* ── F) CRYPTO ────────────────────────────────────────────── */
    if (lower.includes("crypto") || lower.includes("bitcoin") || lower.includes("btc") || lower.includes("ethereum") || lower.includes("eth")) {
      const ticker = parseTicker(message) || "BTC";
      if (!CRYPTO_TICKERS.has(ticker)) {
        return NextResponse.json({ reply: `No reconozco el ticker crypto *${ticker}*.` });
      }
      const quote = await getCryptoQuote(ticker);
      if (!quote) {
        return NextResponse.json({ reply: `No se encontró cotización para *${ticker}*.` });
      }
      const sign24 = quote.change24h !== null ? (quote.change24h >= 0 ? "+" : "") : "";
      const cap = quote.marketCapUsd !== null ? `\n🏦 Cap: $${(quote.marketCapUsd / 1e9).toFixed(2)}B` : "";
      return NextResponse.json({
        reply: `🪙 *${ticker}* — ${quote.name}\n💵 Precio: $${quote.priceUsd.toFixed(2)}\n📊 24h: ${sign24}${quote.change24h?.toFixed(2) ?? "N/A"}%${cap}`,
      });
    }

    /* ── G) DEFAULT — AI FREE FORM ────────────────────────────── */
    const { allowed } = await checkAndConsumeQuota(1);
    if (!allowed) {
      return NextResponse.json({ reply: QUOTA_MSG });
    }

    const userContext = await buildUserContext(chatId);
    const systemPrompt = `Eres Quartly, analista bursátil personal en español. Tienes acceso a datos del usuario. Responde de forma concisa, máximo 3 párrafos.

Contexto del usuario:
${userContext}`;

    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [
          { role: "system", content: systemPrompt },
          ...(history?.slice(-6) ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    if (!orRes.ok) {
      return NextResponse.json({ reply: "Error al contactar el asistente AI." });
    }

    const orData = (await orRes.json()) as { choices?: Array<{ message: { content: string } }> };
    const reply = orData.choices?.[0]?.message?.content || "No pude procesar tu consulta.";
    return NextResponse.json({ reply, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ reply: "Error al procesar tu consulta. Intenta de nuevo." }, { status: 200 });
  }
}
