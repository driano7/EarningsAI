import { kv } from "@vercel/kv";

const DAILY_LIMIT = 25;

interface QuotaData {
  used: number;
  resetDate: string;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

async function getQuotaData(): Promise<QuotaData> {
  const data = await kv.get<QuotaData>("openrouter_quota");
  if (!data) {
    return { used: 0, resetDate: todayStr() };
  }
  return data;
}

export async function checkAndConsumeQuota(amount: number): Promise<{ allowed: boolean; remaining: number }> {
  const today = todayStr();
  let data = await getQuotaData();

  if (data.resetDate < today) {
    data = { used: 0, resetDate: today };
  }

  if (data.used + amount > DAILY_LIMIT) {
    return { allowed: false, remaining: DAILY_LIMIT - data.used };
  }

  data.used += amount;
  await kv.set("openrouter_quota", data);

  return { allowed: true, remaining: DAILY_LIMIT - data.used };
}

export async function getRemainingQuota(): Promise<number> {
  const today = todayStr();
  let data = await getQuotaData();

  if (data.resetDate < today) {
    data = { used: 0, resetDate: today };
  }

  return DAILY_LIMIT - data.used;
}

export function getQuotaExceededMessage(): string {
  return `⚠️ *Límite diario de análisis alcanzado*
Se usaron todos los análisis con IA disponibles por hoy (25/25).
📋 Datos disponibles sin IA:
[datos crudos de Finnhub: fecha reporte, EPS estimado, señal de analistas, precio actual]
🕐 Los análisis completos se reanudan mañana automáticamente.`;
}
