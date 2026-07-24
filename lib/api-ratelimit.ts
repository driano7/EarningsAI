import { kv } from "@vercel/kv";

interface RateLimitData {
  used: number;
  resetDate: string;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export async function checkAndConsumeRateLimit(
  key: string,
  dailyLimit: number
): Promise<{ allowed: boolean; remaining: number }> {
  const today = todayStr();
  const raw = await kv.get<RateLimitData>(key);

  let data: RateLimitData = raw && raw.resetDate === today
    ? raw
    : { used: 0, resetDate: today };

  if (data.used >= dailyLimit) {
    return { allowed: false, remaining: 0 };
  }

  data.used += 1;
  await kv.set(key, data, { ex: 86400 });

  return { allowed: true, remaining: dailyLimit - data.used };
}

export async function getRateLimitRemaining(
  key: string,
  dailyLimit: number
): Promise<number> {
  const today = todayStr();
  const raw = await kv.get<RateLimitData>(key);

  if (!raw || raw.resetDate !== today) return dailyLimit;
  return Math.max(0, dailyLimit - raw.used);
}
