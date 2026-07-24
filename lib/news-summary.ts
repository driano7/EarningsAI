import { kv } from "@vercel/kv";
import { checkAndConsumeRateLimit } from "./api-ratelimit";
import { getTickerNews, getMarketNews, type NewsArticle } from "./news";
import { getMacroSnapshot, type MacroSerie } from "./macro";
import { getUserWatchlist } from "./kv";
import { checkAndConsumeQuota } from "./quota";
import { SP500 } from "./sp500";
import { ETFS } from "./etfs";
import { CUSTOM_TICKERS } from "./custom-tickers";

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
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatMacroBlock(macros: MacroSerie[]): string {
  if (macros.length === 0) return "";
  let msg = "📡 *Indicadores Macro*\n";
  for (const m of macros) {
    if (m.value === null) continue;
    const change = m.change !== null ? (m.change >= 0 ? `+${m.change.toFixed(2)}` : m.change.toFixed(2)) : "N/A";
    const emoji = m.change !== null ? (m.change > 0 ? "📈" : m.change < 0 ? "📉" : "➡️") : "⚪";
    msg += `${emoji} ${m.label}: ${m.value.toFixed(2)}${m.unit} (${change})\n`;
  }
  return msg + "\n";
}

export async function generateDailyNewsSummary(chatId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `news_summary:${chatId}:${today}`;
  const cached = await kv.get<string>(cacheKey);
  if (cached) return cached;

  const { stocks, etfs } = await getUserWatchlist(chatId);
  const allTickers = [...stocks, ...etfs];

  const [marketNews, macros] = await Promise.all([
    getMarketNews(5),
    getMacroSnapshot(),
  ]);

  const tickerNews: Array<{ ticker: string; articles: NewsArticle[] }> = [];
  for (const ticker of allTickers.slice(0, 10)) {
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
    const summary = await generateAISummary(today, marketNews, macros, tickerNews);
    if (summary) {
      await kv.set(cacheKey, summary, { ex: 86400 });
      return summary;
    }
  }

  let msg = `📰 *Resumen Diario — ${formatDate(today)}*\n\n`;

  msg += formatMacroBlock(macros);

  if (marketNews.length > 0) {
    msg += `🌐 *Mercado General*\n`;
    for (const article of marketNews.slice(0, 3)) {
      const sentiment = getSentimentEmoji(article.title);
      msg += `${sentiment} _${article.source.name}_: ${article.title}\n`;
      msg += `   ${article.url}\n\n`;
    }
  }

  if (tickerNews.length > 0) {
    msg += `📊 *Tus Tickers*\n`;
    for (const { ticker, articles } of tickerNews) {
      msg += `\n*${ticker}*\n`;
      for (const article of articles) {
        const sentiment = getSentimentEmoji(article.title);
        msg += `${sentiment} ${article.title}\n`;
      }
    }
  }

  if (marketNews.length === 0 && tickerNews.length === 0 && macros.length === 0) {
    msg += `_No hay datos disponibles hoy._`;
  }

  await kv.set(cacheKey, msg, { ex: 86400 });
  return msg;
}

async function generateAISummary(
  today: string,
  marketNews: NewsArticle[],
  macros: MacroSerie[],
  tickerNews: Array<{ ticker: string; articles: NewsArticle[] }>
): Promise<string | null> {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
  if (!OPENROUTER_KEY) return null;

  const macroText = macros
    .filter((m) => m.value !== null)
    .map((m) => `- ${m.label}: ${m.value}${m.unit} (cambio: ${m.change !== null ? m.change.toFixed(3) : "N/A"})`)
    .join("\n");

  const marketText = marketNews
    .slice(0, 5)
    .map((a) => `- [${a.source.name}] ${a.title}: ${a.description || ""}`)
    .join("\n");

  const tickerText = tickerNews
    .flatMap(({ ticker, articles }) =>
      articles.map((a) => `- ${ticker}: ${a.title}`)
    )
    .join("\n");

  const prompt = `Eres un analista financiero experto. Genera un resumen ejecutivo del día en español para un inversionista retail.

FECHA: ${today}

INDICADORES MACRO:
${macroText || "No disponibles"}

NOTICIAS DE MERCADO:
${marketNews.length > 0 ? marketNews.map((a) => `- ${a.title}`).join("\n") : "No hay noticias"}

NOTICIAS DE TICKERS:
${tickerText || "No hay noticias específicas"}

INSTRUCCIONES:
1. Resume en máximo 5 párrafos cortos
2. Empieza con el estado del mercado (alcista/bajista/lateral)
3. Menciona los indicadores macro más relevantes
4. Destaca las noticias más importantes de los tickers
5. Termina con una recomendación general del día
6. Usa emojis moderadamente
7. Sé conciso y directo
8. NO uses markdown, solo texto plano con emojis`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return `📰 *Resumen Diario — ${formatDate(today)}*\n\n${content}`;
  } catch {
    return null;
  }
}

function getSentimentEmoji(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("sube") || lower.includes("rally") || lower.includes("ganancia") || lower.includes("alza")) return "🟢";
  if (lower.includes("baja") || lower.includes("caída") || lower.includes("pánico") || lower.includes("crash")) return "🔴";
  return "⚪";
}
