import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAllUsers, getUserWatchlist, hasReminded, markReminded } from "../lib/kv";
import { getEarningsCalendar, getQuote, getRecommendationTrends, formatAnalystSignal } from "../lib/finnhub";
import { getLogoUrl } from "../lib/logo";
import { sendMessageWithLogo } from "../lib/telegram";
import { formatPriceBlock, PriceData } from "../lib/price";
import { SP500 } from "../lib/sp500";
import { ETFS } from "../lib/etfs";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function daysFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const users = await getAllUsers();
  if (users.length === 0) {
    return res.status(200).json({ ok: true, message: "No users" });
  }

  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const to = future.toISOString().split("T")[0];

  const calendar = await getEarningsCalendar(today, to);

  for (const chatId of users) {
    const { stocks, etfs } = await getUserWatchlist(chatId);
    const allTickers = [...stocks, ...etfs];

    for (const event of calendar) {
      if (!allTickers.includes(event.symbol)) continue;

      const days = daysFromToday(event.date);
      const isEtf = etfs.includes(event.symbol);
      const todayStr = event.date;

      if (days === 3) {
        const reminded = await hasReminded(chatId, event.symbol, todayStr, "3d");
        if (reminded) continue;

        const [recs] = await Promise.all([getRecommendationTrends(event.symbol)]);
        const signal = formatAnalystSignal(recs);
        const spCompany = SP500.find((c) => c.ticker === event.symbol);
        const etfObj = ETFS.find((e) => e.ticker === event.symbol);
        const name = spCompany?.name || etfObj?.name || event.name || event.symbol;
        const logoUrl = await getLogoUrl(event.symbol, isEtf);

        const msg = `📅 *Recordatorio 3 días*
*${event.symbol}* — ${name}
📆 Reporta: ${formatDate(event.date)} (${event.hour || "N/A"})
📊 EPS Est: $${event.estimate.toFixed(2)}
${signal}`;

        await sendMessageWithLogo(chatId, msg, logoUrl);
        await markReminded(chatId, event.symbol, todayStr, "3d");
      }

      if (days === 1) {
        const reminded = await hasReminded(chatId, event.symbol, todayStr, "1d");
        if (reminded) continue;

        const [quote, recs] = await Promise.all([getQuote(event.symbol), getRecommendationTrends(event.symbol)]);
        const signal = formatAnalystSignal(recs);
        const spCompany = SP500.find((c) => c.ticker === event.symbol);
        const etfObj = ETFS.find((e) => e.ticker === event.symbol);
        const name = spCompany?.name || etfObj?.name || event.name || event.symbol;
        const sector = spCompany?.sector || etfObj?.category || "";
        const logoUrl = await getLogoUrl(event.symbol, isEtf);

        let priceText = "";
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
          priceText = formatPriceBlock(event.symbol, name, sector, priceData);
        }

        const msg = `⏰ *Reporta MAÑANA*
*${event.symbol}* — ${name}
📆 ${formatDate(event.date)} (${event.hour || "N/A"})
📊 EPS Est: $${event.estimate.toFixed(2)}
${priceText}
${signal}`;

        await sendMessageWithLogo(chatId, msg, logoUrl);
        await markReminded(chatId, event.symbol, todayStr, "1d");
      }
    }
  }

  return res.status(200).json({ ok: true });
}
