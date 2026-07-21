const OR_BASE = "https://openrouter.ai/api/v1/chat/completions";
const OR_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL = "google/gemini-flash-1.5";

export interface TickerAnalysis {
  ticker: string;
  verdict: "COMPRAR" | "MANTENER" | "VENDER" | "OBSERVAR";
  summary: string;
  catalysts: string[];
  risks: string[];
  confidence: number;
}

export interface PortfolioInsight {
  overallHealth: "excelente" | "bueno" | "neutral" | "precaución" | "alerta";
  summary: string;
  topHolding: string;
  weakestHolding: string;
  suggestions: string[];
}

async function callOpenRouter(prompt: string, maxTokens: number, temp: number): Promise<string | null> {
  const res = await fetch(OR_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OR_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: temp,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}

export async function analyzeTickerWithAI(
  ticker: string,
  context: {
    currentPrice: number;
    change1m: number | null;
    epsHistory: string;
    analystSignal: string;
    hypeScore?: number;
  }
): Promise<TickerAnalysis | null> {
  const { checkAndConsumeQuota } = await import("./quota");
  const { allowed } = await checkAndConsumeQuota(1);
  if (!allowed) return null;

  const prompt = `Analiza esta acción para un inversionista hispanohablante.
Ticker: ${ticker}
Precio actual: $${context.currentPrice}
Cambio 1 mes: ${context.change1m !== null ? context.change1m.toFixed(2) + "%" : "N/D"}
Historial EPS: ${context.epsHistory}
Señal analistas: ${context.analystSignal}
Hype Score: ${context.hypeScore ?? "N/D"}/100

Responde SOLO con este JSON (sin markdown):
{
  "verdict": "COMPRAR|MANTENER|VENDER|OBSERVAR",
  "summary": "máximo 2 oraciones",
  "catalysts": ["catalizador 1", "catalizador 2"],
  "risks": ["riesgo 1"],
  "confidence": 75
}`;

  const content = await callOpenRouter(prompt, 300, 0.3);
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as Omit<TickerAnalysis, "ticker">;
    return { ticker, ...parsed };
  } catch {
    return null;
  }
}

export async function analyzePortfolioWithAI(
  positions: Array<{
    ticker: string;
    type: string;
    buyPrice: number;
    currentPrice?: number;
    quantity: number;
  }>
): Promise<PortfolioInsight | null> {
  const { checkAndConsumeQuota } = await import("./quota");
  const { allowed } = await checkAndConsumeQuota(2);
  if (!allowed) return null;

  const positionsSummary = positions
    .map((p) => {
      const pnl = p.currentPrice
        ? ((p.currentPrice - p.buyPrice) / p.buyPrice * 100).toFixed(1)
        : "N/D";
      return `${p.ticker} (${p.type}): comprado a $${p.buyPrice}, actual $${p.currentPrice ?? "N/D"}, P&L: ${pnl}%, cantidad: ${p.quantity}`;
    })
    .join("\n");

  const prompt = `Analiza este portafolio de inversión. Responde en español como analista senior.
${positionsSummary}

Responde SOLO con este JSON:
{
  "overallHealth": "excelente|bueno|neutral|precaución|alerta",
  "summary": "2 oraciones sobre el estado general",
  "topHolding": "ticker del mejor rendimiento",
  "weakestHolding": "ticker del peor rendimiento",
  "suggestions": ["sugerencia 1 accionable", "sugerencia 2"]
}`;

  const content = await callOpenRouter(prompt, 400, 0.4);
  if (!content) return null;

  try {
    return JSON.parse(content) as PortfolioInsight;
  } catch {
    return null;
  }
}
