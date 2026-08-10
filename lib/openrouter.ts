/*
 * Quartly Bot — lib/openrouter.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export interface CompanyData {
  ticker: string;
  name: string;
  sector: string;
  date: string;
  hour: string;
  epsEstimate: number;
  epsActual: number | null;
  revenueEstimate: number | null;
  surprisePercent: number | null;
  price: number | null;
  analystSignal: string;
  epsHistory: string;
}

export interface CompanyHype {
  ticker: string;
  name: string;
  date: string;
  hypeScore: number;
  avgSurprise: number;
  buyRatio: number;
  priceChange1m: number;
}

export interface HypeRanking {
  top5: CompanyHype[];
  bottom5: CompanyHype[];
}

export interface BatchReportData {
  favReports: CompanyData[];
  hypeRanking: HypeRanking | null;
}

export interface ParsedBatchReport {
  favReports: Record<string, string>;
  hypeMessage: string | null;
}

const SYSTEM_PROMPT = `Eres un analista bursátil senior que escribe para inversores hispanohablantes con nivel intermedio de conocimiento financiero. El bot se llama Quartly.
Recibirás dos secciones de datos:
1. REPORTES DE HOY: empresas que acaban de publicar sus resultados trimestrales
2. HYPE RANKING: empresas que reportarán en los próximos 7 días, ordenadas por potencial
FORMATO DE RESPUESTA OBLIGATORIO — usa estos delimitadores exactos:
Para cada empresa de REPORTES DE HOY:
---SECTION:FAV_TICKER---
[análisis aquí]
Para el bloque Hype:
---SECTION:HYPE---
[mensaje hype aquí]
REGLAS PARA REPORTES DE HOY (máximo 220 palabras por empresa, prosa fluida, sin listas ni tablas):
- Explica todas las abreviaciones entre paréntesis la primera vez: EPS (Ganancia por Acción, Earnings Per Share), Revenue (Ingresos Totales), BMO (Antes de Apertura del Mercado), AMC (Después del Cierre), YoY (comparado con mismo período del año anterior), Beat (superó expectativas), Miss (no alcanzó expectativas), guidance (proyección futura de la empresa)
- Empieza con el dato más importante, sin introducción genérica
- Menciona Beat o Miss en EPS y en Revenue por separado
- Incluye patrón de los 4 trimestres anteriores
- Menciona señal de analistas (Comprar/Mantener/Vender)
- Cierra con qué vigilar en próximas sesiones
- ÚLTIMA LÍNEA siempre: VEREDICTO: SETUP FAVORABLE ✅ o VEREDICTO: NEUTRAL ⚠️ o VEREDICTO: PRECAUCIÓN 🔴
- Sin markdown, solo texto plano con emojis del veredicto
REGLAS PARA EL BLOQUE HYPE (máximo 300 palabras total):
- Título: 🔥 HYPE DE LA SEMANA — TOP 5 MEJORES SETUPS seguido de ⚠️ TOP 5 MAYOR RIESGO
- Para cada empresa: una línea con ticker, nombre, fecha de reporte y una frase explicando por qué está en esa lista
- Explica Hype Score la primera vez: (puntuación calculada con base en historial de beats, señal de analistas y tendencia de precio)
- Termina con una línea de contexto general de la semana de earnings
- Sin markdown, solo texto plano con los emojis indicados`;

export async function generateBatchReport(data: BatchReportData): Promise<ParsedBatchReport> {
  const favSection = data.favReports
    .map((c) => {
      const epsActual = c.epsActual !== null ? `$${c.epsActual.toFixed(2)}` : "N/A";
      const revEst = c.revenueEstimate !== null ? `$${(c.revenueEstimate / 1e9).toFixed(2)}B` : "N/A";
      return `[${c.ticker}] ${c.name} (${c.sector})
Fecha: ${c.date} (${c.hour})
EPS Est: $${c.epsEstimate.toFixed(2)} | EPS Real: ${epsActual}
Revenue Est: ${revEst}
Surprise: ${c.surprisePercent !== null ? c.surprisePercent.toFixed(1) + "%" : "N/A"}
Precio: ${c.price !== null ? "$" + c.price.toFixed(2) : "N/A"}
${c.analystSignal}
Historial EPS:
${c.epsHistory}`;
    })
    .join("\n\n---\n\n");

  let hypeSection = "";
  if (data.hypeRanking) {
    hypeSection = "TOP 5 MEJORES SETUPS:\n";
    for (const h of data.hypeRanking.top5) {
      hypeSection += `${h.ticker} - ${h.name} (${h.date}) - Score: ${h.hypeScore.toFixed(1)}\n`;
    }
    hypeSection += "\nTOP 5 MAYOR RIESGO:\n";
    for (const h of data.hypeRanking.bottom5) {
      hypeSection += `${h.ticker} - ${h.name} (${h.date}) - Score: ${h.hypeScore.toFixed(1)}\n`;
    }
  }

  const userMessage = `REPORTES DE HOY:\n\n${favSection || "Sin reportes hoy."}\n\nHYPE RANKING:\n\n${hypeSection || "Sin datos de hype."}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://quartly.vercel.app",
      "X-Title": "Quartly Bot",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      temperature: 0.3,
      max_tokens: 2500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API error: ${res.status}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const choices = (json.choices as Array<{ message: { content: string } }>) || [];
  const content = choices[0]?.message?.content || "";

  return parseBatchResponse(content, data.favReports);
}

function parseBatchResponse(content: string, favReports: CompanyData[]): ParsedBatchReport {
  const result: ParsedBatchReport = { favReports: {}, hypeMessage: null };

  const sections = content.split("---SECTION:");
  for (const section of sections) {
    const colonIdx = section.indexOf("---");
    if (colonIdx === -1) continue;

    let name = section.substring(0, colonIdx).trim();
    const body = section.substring(colonIdx + 3).trim();

    if (name === "HYPE") {
      result.hypeMessage = body;
    } else if (name.startsWith("FAV_")) {
      const ticker = name.substring(4);
      result.favReports[ticker] = body;
    } else if (name === name.toUpperCase() && name.length <= 5) {
      result.favReports[name] = body;
    }
  }

  for (const company of favReports) {
    if (!result.favReports[company.ticker]) {
      result.favReports[company.ticker] = buildFallbackReport(company);
    }
  }

  return result;
}

function buildFallbackReport(c: CompanyData): string {
  const epsActual = c.epsActual !== null ? `$${c.epsActual.toFixed(2)}` : "N/A";
  const surprise = c.surprisePercent !== null ? `${c.surprisePercent >= 0 ? "+" : ""}${c.surprisePercent.toFixed(1)}%` : "N/A";
  return `${c.ticker} reportó EPS real de ${epsActual} vs estimado $${c.epsEstimate.toFixed(2)} (${surprise}). ${c.analystSignal}. Próximo reporte: ${c.date} (${c.hour}). VEREDICTO: NEUTRAL ⚠️`;
}
