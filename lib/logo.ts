const ETF_LOGOS: Record<string, string> = {
  SPY: "https://cdn.simpleicons.org/blackrock",
  QQQ: "https://cdn.simpleicons.org/invesco",
  GLD: "https://cdn.simpleicons.org/gold",
};

export async function getLogoUrl(ticker: string, isEtf: boolean): Promise<string | null> {
  if (isEtf) {
    return ETF_LOGOS[ticker.toUpperCase()] || null;
  }

  try {
    const token = process.env.FINNHUB_API_KEY;
    const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${token}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (data && typeof data.logo === "string" && data.logo.trim() !== "") {
      return data.logo;
    }
    return null;
  } catch {
    return null;
  }
}
