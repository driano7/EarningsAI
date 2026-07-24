import { kv } from "@vercel/kv";
import { checkAndConsumeRateLimit } from "./api-ratelimit";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const FRED_KEY = process.env.FRED || "";
const FRED_DAILY_LIMIT = 50;
const FRED_RATE_KEY = "ratelimit:fred";

export interface MacroSerie {
  id: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  unit: string;
  date: string;
}

interface FredObservation {
  value: number | null;
  prevValue: number | null;
  date: string;
}

const MACRO_SERIES = [
  { id: "FEDFUNDS",   label: "Tasa Fed",        unit: "%" },
  { id: "CPIAUCSL",   label: "Inflación USA",    unit: "%" },
  { id: "UNRATE",     label: "Desempleo USA",    unit: "%" },
  { id: "T10Y2Y",     label: "Curva 10Y-2Y",     unit: "bps" },
  { id: "DCOILWTICO", label: "Petróleo WTI",     unit: "USD" },
  { id: "DTWEXBGS",   label: "DXY (Dólar)",      unit: "índice" },
  { id: "SP500",      label: "S&P 500",           unit: "pts" },
  { id: "VIXCLS",     label: "VIX",               unit: "pts" },
];

async function fetchFredSerie(seriesId: string): Promise<FredObservation> {
  const cacheKey = `fred:${seriesId}`;
  const cached = await kv.get<FredObservation>(cacheKey);
  if (cached) return cached;

  const { allowed } = await checkAndConsumeRateLimit(FRED_RATE_KEY, FRED_DAILY_LIMIT);
  if (!allowed) return { value: null, prevValue: null, date: "" };

  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=2`;
  const res = await fetch(url);
  if (!res.ok) return { value: null, prevValue: null, date: "" };

  const data = (await res.json()) as { observations?: Array<{ value: string; date: string }> };
  const obs = data.observations || [];
  const latest = obs[0];
  const prev = obs[1];

  const parse = (v: string | undefined): number | null =>
    v && v !== "." ? parseFloat(v) : null;

  const result: FredObservation = {
    value: parse(latest?.value),
    prevValue: parse(prev?.value),
    date: latest?.date || "",
  };

  await kv.set(cacheKey, result, { ex: 14400 });
  return result;
}

export async function getMacroSnapshot(): Promise<MacroSerie[]> {
  const results = await Promise.allSettled(
    MACRO_SERIES.map(async (serie) => {
      const { value, prevValue, date } = await fetchFredSerie(serie.id);
      const change = value !== null && prevValue !== null ? value - prevValue : null;
      return { ...serie, value, previousValue: prevValue, change, date } satisfies MacroSerie;
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<MacroSerie> => r.status === "fulfilled")
    .map((r) => r.value);
}
