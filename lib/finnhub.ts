const BASE = "https://finnhub.io/api/v1";
const TOKEN = process.env.FINNHUB_API_KEY || "";

export interface EarningEvent {
  symbol: string;
  actual: number | null;
  estimate: number;
  surprise: number | null;
  surprisePercent: number | null;
  year: number;
  quarter: number;
  period: string;
}

export interface RecommendationTrend {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
}

export interface QuoteData {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface CalendarEarning {
  symbol: string;
  name: string;
  actual?: number;
  estimate: number;
  surprise?: number;
  surprisePercent?: number;
  year: number;
  quarter: number;
  period: string;
  revenueEstimate?: number;
  date: string;
  hour?: string;
}

export async function getEarningsHistory(symbol: string): Promise<EarningEvent[]> {
  const res = await fetch(`${BASE}/stock/earnings?symbol=${symbol}&token=${TOKEN}`);
  if (!res.ok) return [];
  return res.json() as Promise<EarningEvent[]>;
}

export async function getRecommendationTrends(symbol: string): Promise<RecommendationTrend[]> {
  try {
    const res = await fetch(`${BASE}/stock/recommendation?symbol=${symbol}&token=${TOKEN}`);
    if (!res.ok) return [];
    return res.json() as Promise<RecommendationTrend[]>;
  } catch {
    return [];
  }
}

export async function getQuote(symbol: string): Promise<QuoteData | null> {
  const res = await fetch(`${BASE}/quote?symbol=${symbol}&token=${TOKEN}`);
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (!data || !data.c) return null;
  return data as unknown as QuoteData;
}

export async function getEarningsCalendar(from: string, to: string, symbol?: string): Promise<CalendarEarning[]> {
  let url = `${BASE}/calendar/earnings?from=${from}&to=${to}&token=${TOKEN}`;
  if (symbol) {
    url += `&symbol=${symbol}`;
  }
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, unknown>;
  return (data?.earningsCalendar as CalendarEarning[]) || [];
}

export async function getCompanyProfile(symbol: string): Promise<{ name: string; exchange: string; industry: string } | null> {
  const res = await fetch(`${BASE}/stock/profile2?symbol=${symbol}&token=${TOKEN}`);
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (!data || !data.name) return null;
  return { name: data.name as string, exchange: (data.exchange as string) || "", industry: (data.finnhubIndustry as string) || "" };
}

export function formatEPSBlock(earnings: EarningEvent[]): string {
  const last4 = earnings.slice(0, 4);
  if (last4.length === 0) return "";

  const quarters = last4
    .map((e) => {
      const qLabel = `Q${e.quarter} ${e.year}`;
      const est = e.estimate.toFixed(2);
      const real = e.actual !== null && e.actual !== undefined ? e.actual.toFixed(2) : "N/A";
      let beatMiss = "";
      if (e.surprisePercent !== null && e.surprisePercent !== undefined) {
        const sign = e.surprisePercent >= 0 ? "+" : "";
        const label = e.surprisePercent >= 0 ? "Beat ✅" : "Miss ❌";
        beatMiss = `→ *${sign}${e.surprisePercent.toFixed(1)}% ${label}*`;
      }
      return `  ${qLabel}: est. $${est} → real $${real} ${beatMiss}`;
    })
    .join("\n");

  return `📋 Últimos 4 trimestres — EPS (Ganancia por Acción):\n${quarters}`;
}

export function formatAnalystSignal(recs: RecommendationTrend[]): string {
  if (recs.length === 0) return "🎯 Señal de analistas: Sin datos";
  const latest = recs[0];
  const total = latest.buy + latest.strongBuy + latest.hold + latest.sell + latest.strongSell;
  if (total === 0) return "🎯 Señal de analistas: Sin datos";
  const buys = latest.buy + latest.strongBuy;
  const holds = latest.hold;
  const sells = latest.sell + latest.strongSell;
  return `🎯 Señal de analistas: ${buys} Comprar / ${holds} Mantener / ${sells} Vender`;
}
