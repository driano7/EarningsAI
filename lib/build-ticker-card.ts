/*
 * Quartly Bot — lib/build-ticker-card.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { SP500 } from "./sp500";
import { ETFS } from "./etfs";
import { CUSTOM_TICKERS } from "./custom-tickers";
import { getQuote, getRecommendationTrends, getEarningsHistory, formatEPSBlock, formatAnalystSignal } from "./finnhub";
import { getLogoUrl } from "./logo";
import { formatPriceBlock, PriceData } from "./price";
import { getYahooPriceDataFull } from "./yahoo";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function resolveTickerInfo(ticker: string): { name: string; sector: string } {
  const sp = SP500.find((c) => c.ticker === ticker);
  if (sp) return { name: sp.name, sector: sp.sector };
  const etf = ETFS.find((e) => e.ticker === ticker);
  if (etf) return { name: etf.name, sector: etf.category };
  const custom = CUSTOM_TICKERS.find((c) => c.ticker === ticker);
  if (custom) return { name: custom.name, sector: custom.sector };
  return { name: ticker, sector: "" };
}

export async function buildTickerCard(
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
