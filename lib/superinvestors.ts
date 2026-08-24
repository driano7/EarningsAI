/*
 * Quartly Bot — lib/superinvestors.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Fetches and caches 13F-HR filings from SEC EDGAR for superinvestors.
 * Cache is quarterly (13F filed quarterly: 45 days after quarter end).
 */

import { kv } from "@vercel/kv";

export interface Holding {
  name: string;
  ticker: string;
  cusip: string;
  shares: number;
  value: number; // in thousands (as reported in 13F)
  putCall: string; // "Put" | "Call" | ""
  investmentDiscretion: string;
  votingAuthority: { sole: number; shared: number; none: number };
}

export interface Filing {
  cik: string;
  name: string;
  quarterEnd: string; // YYYY-MM-DD
  filedAt: string; // ISO date
  holdings: Holding[];
  totalValue: number; // in thousands
}

export interface HoldingChange {
  ticker: string;
  name: string;
  action: "NEW" | "INCREASED" | "DECREASED" | "SOLD_OUT";
  prevShares: number;
  currShares: number;
  changePct: number;
  currValue: number; // in thousands
  sector?: string;
}

export interface SuperInvestorChanges {
  investor: SuperInvestor;
  investorName: string;
  quarterEnd: string;
  filedAt: string;
  changes: HoldingChange[];
  topNew: HoldingChange[];
  topIncreased: HoldingChange[];
  topDecreased: HoldingChange[];
  topSoldOut: HoldingChange[];
}

export type SuperInvestor =
  | "BERKSHIRE"
  | "PERSHING_SQUARE"
  | "DUQUESNE";

const SUPERINVESTORS: Record<SuperInvestor, { cik: string; name: string; focus: string }> = {
  BERKSHIRE: {
    cik: "0001067983",
    name: "Berkshire Hathaway",
    focus: "S&P 500 / Calidad / Value",
  },
  PERSHING_SQUARE: {
    cik: "0001336528",
    name: "Pershing Square (Bill Ackman)",
    focus: "Nasdaq / Big Tech / Concentrado",
  },
  DUQUESNE: {
    cik: "0001543152",
    name: "Duquesne Family Office (Stanley Druckenmiller)",
    focus: "Semiconductores / IA / Macrotendencias",
  },
};

const SEC_BASE = "https://data.sec.gov";
const EDGAR_HEADERS = {
  "User-Agent": "Quartly Bot (donovan@quartly.app)",
  "Accept-Encoding": "gzip, deflate",
};

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: EDGAR_HEADERS });
    if (res.ok || res.status === 404) return res;
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    throw new Error(`SEC EDGAR error: ${res.status} ${res.statusText}`);
  }
  throw new Error(`SEC EDGAR max retries exceeded`);
}

function getQuarterEnd(date = new Date()): string {
  const d = new Date(date);
  const month = d.getMonth();
  let quarterEndMonth: number;
  let quarterEndYear = d.getFullYear();

  if (month >= 9) { // Q3 ends Sep 30, filed by Nov 14
    quarterEndMonth = 9;
  } else if (month >= 6) { // Q2 ends Jun 30, filed by Aug 14
    quarterEndMonth = 6;
  } else if (month >= 3) { // Q1 ends Mar 31, filed by May 15
    quarterEndMonth = 3;
  } else { // Q4 ends Dec 31 (prev year), filed by Feb 14
    quarterEndMonth = 12;
    quarterEndYear -= 1;
  }

  const lastDay = new Date(quarterEndYear, quarterEndMonth, 0).getDate();
  return `${quarterEndYear}-${quarterEndMonth.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
}

async function getLatestFilingUrl(cik: string, quarterEnd: string): Promise<string | null> {
  const submissionsUrl = `${SEC_BASE}/submissions/CIK${cik}.json`;
  const res = await fetchWithRetry(submissionsUrl);
  if (!res.ok) return null;

  const data = await res.json();
  const recentFilings = data.filings?.recent;

  if (!recentFilings) return null;

  const formTypes = recentFilings.form;
  const filingDates = recentFilings.filingDate;
  const accessionNumbers = recentFilings.accessionNumber;
  const primaryDocuments = recentFilings.primaryDocument;

  for (let i = 0; i < formTypes.length; i++) {
    if (formTypes[i] === "13F-HR" || formTypes[i] === "13F-HR/A") {
      const filingDate = filingDates[i];
      if (filingDate >= quarterEnd) {
        const accession = accessionNumbers[i].replace(/-/g, "");
        const doc = primaryDocuments[i];
        return `${SEC_BASE}/Archives/edgar/data/${parseInt(cik, 10)}/${accession}/${doc}`;
      }
    }
  }

  return null;
}

async function fetch13FData(cik: string, quarterEnd: string): Promise<Filing | null> {
  const cacheKey = `superinvestor:13f:${cik}:${quarterEnd}`;
  const cached = await kv.get<Filing>(cacheKey);
  if (cached) return cached;

  const filingUrl = await getLatestFilingUrl(cik, quarterEnd);
  if (!filingUrl) return null;

  const res = await fetchWithRetry(filingUrl);
  if (!res.ok) return null;

  const xmlText = await res.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  const infoTable = xmlDoc.querySelector("informationTable");
  if (!infoTable) return null;

  const holdings: Holding[] = [];
  let totalValue = 0;

  const rows = infoTable.querySelectorAll("infoTable");
  for (const row of rows) {
    const name = row.querySelector("nameOfIssuer")?.textContent?.trim() || "";
    const ticker = row.querySelector("titleOfClass")?.textContent?.trim() || "";
    const cusip = row.querySelector("cusip")?.textContent?.trim() || "";
    const shares = parseInt(row.querySelector("sshPrnamt")?.textContent?.trim() || "0", 10);
    const value = parseInt(row.querySelector("value")?.textContent?.trim() || "0", 10);
    const putCall = row.querySelector("putCall")?.textContent?.trim() || "";
    const investmentDiscretion = row.querySelector("investmentDiscretion")?.textContent?.trim() || "";
    const sole = parseInt(row.querySelector("sole")?.textContent?.trim() || "0", 10);
    const shared = parseInt(row.querySelector("shared")?.textContent?.trim() || "0", 10);
    const none = parseInt(row.querySelector("none")?.textContent?.trim() || "0", 10);

    if (name && shares > 0) {
      holdings.push({
        name,
        ticker: ticker || cusip,
        cusip,
        shares,
        value,
        putCall,
        investmentDiscretion,
        votingAuthority: { sole, shared, none },
      });
      totalValue += value;
    }
  }

  const filing: Filing = {
    cik,
    name: SUPERINVESTORS[cik as keyof typeof SUPERINVESTORS]?.name || cik,
    quarterEnd,
    filedAt: new Date().toISOString(),
    holdings,
    totalValue,
  };

  await kv.set(cacheKey, filing, { ex: 90 * 86400 }); // 90 days cache
  return filing;
}

function compareHoldings(
  prev: Filing | null,
  curr: Filing
): HoldingChange[] {
  if (!prev) {
    return curr.holdings.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      action: "NEW" as const,
      prevShares: 0,
      currShares: h.shares,
      changePct: 100,
      currValue: h.value,
    }));
  }

  const prevMap = new Map(prev.holdings.map((h) => [h.ticker, h]));
  const changes: HoldingChange[] = [];

  for (const currH of curr.holdings) {
    const prevH = prevMap.get(currH.ticker);
    if (!prevH) {
      changes.push({
        ticker: currH.ticker,
        name: currH.name,
        action: "NEW",
        prevShares: 0,
        currShares: currH.shares,
        changePct: 100,
        currValue: currH.value,
      });
    } else if (currH.shares > prevH.shares) {
      const pct = ((currH.shares - prevH.shares) / prevH.shares) * 100;
      changes.push({
        ticker: currH.ticker,
        name: currH.name,
        action: "INCREASED",
        prevShares: prevH.shares,
        currShares: currH.shares,
        changePct: pct,
        currValue: currH.value,
      });
    } else if (currH.shares < prevH.shares) {
      const pct = ((prevH.shares - currH.shares) / prevH.shares) * 100;
      changes.push({
        ticker: currH.ticker,
        name: currH.name,
        action: "DECREASED",
        prevShares: prevH.shares,
        currShares: currH.shares,
        changePct: -pct,
        currValue: currH.value,
      });
    }
  }

  for (const prevH of prev.holdings) {
    if (!curr.holdings.some((h) => h.ticker === prevH.ticker)) {
      changes.push({
        ticker: prevH.ticker,
        name: prevH.name,
        action: "SOLD_OUT",
        prevShares: prevH.shares,
        currShares: 0,
        changePct: -100,
        currValue: 0,
      });
    }
  }

  return changes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

function getTopChanges(changes: HoldingChange[], action: HoldingChange["action"], limit = 5): HoldingChange[] {
  return changes
    .filter((c) => c.action === action)
    .slice(0, limit);
}

export async function getSuperInvestorChanges(investor: SuperInvestor): Promise<SuperInvestorChanges | null> {
  const config = SUPERINVESTORS[investor];
  const quarterEnd = getQuarterEnd();
  const prevQuarterEnd = getQuarterEnd(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  const [currFiling, prevFiling] = await Promise.all([
    fetch13FData(config.cik, quarterEnd),
    fetch13FData(config.cik, prevQuarterEnd),
  ]);

  if (!currFiling) return null;

  const changes = compareHoldings(prevFiling, currFiling);

  return {
    investor,
    investorName: config.name,
    quarterEnd,
    filedAt: currFiling.filedAt,
    changes,
    topNew: getTopChanges(changes, "NEW", 5),
    topIncreased: getTopChanges(changes, "INCREASED", 5),
    topDecreased: getTopChanges(changes, "DECREASED", 5),
    topSoldOut: getTopChanges(changes, "SOLD_OUT", 5),
  };
}

export async function getAllSuperInvestorChanges(): Promise<SuperInvestorChanges[]> {
  const results = await Promise.allSettled(
    Object.keys(SUPERINVESTORS).map((k) => getSuperInvestorChanges(k as SuperInvestor))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SuperInvestorChanges> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

function formatValue(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}B`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}M`;
  return `$${value}K`;
}

function formatChanges(changes: HoldingChange[]): string {
  if (changes.length === 0) return "  (ninguno)";
  return changes
    .map((c) => {
      const sign = c.action === "INCREASED" || c.action === "NEW" ? "+" : "";
      const sharesStr = c.currShares.toLocaleString();
      return `  • ${c.ticker} (${c.name}): ${sign}${c.changePct.toFixed(1)}% → ${sharesStr} acciones (${formatValue(c.currValue)})`;
    })
    .join("\n");
}

export function formatSuperInvestorForPrompt(changes: SuperInvestorChanges): string {
  const { investor, investorName, quarterEnd, topNew, topIncreased, topDecreased, topSoldOut } = changes;
  const dateStr = new Date(quarterEnd).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  let text = `\n=== ${investorName.toUpperCase()} (13F ${dateStr}) ===\n`;
  text += `Enfoque: ${SUPERINVESTORS[investor]?.focus}\n\n`;

  if (topNew.length > 0) {
    text += `🟢 NUEVAS POSICIONES:\n${formatChanges(topNew)}\n\n`;
  }
  if (topIncreased.length > 0) {
    text += `📈 AUMENTADAS:\n${formatChanges(topIncreased)}\n\n`;
  }
  if (topDecreased.length > 0) {
    text += `📉 REDUCIDAS:\n${formatChanges(topDecreased)}\n\n`;
  }
  if (topSoldOut.length > 0) {
    text += `🔴 VENDIDAS (SALIDA TOTAL):\n${formatChanges(topSoldOut)}\n\n`;
  }

  return text;
}