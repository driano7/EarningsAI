/*
 * Quartly Bot — app/api/strategy/parse/route.ts
 * AI Strategy Visualizer — convierte lenguaje natural en un StrategyJSON via OpenRouter.
 * Copyright (c) Donovan Riaño. All rights reserved.
 */

import { NextRequest, NextResponse } from "next/server";
import type { StrategyJSON } from "@/lib/strategy-types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `
You are a trading strategy parser for a financial app called Quartly.
Convert the user's natural language trading strategy into a strict JSON object.
Output ONLY valid JSON — no markdown, no explanation, no code blocks.

Return this exact schema:
{
  "indicators": [
    {
      "type": "EMA",
      "params": { "period": 20 },
      "color": "#2196F3",
      "panel": "main"
    }
  ],
  "entry_rules": [
    {
      "left": "EMA_20",
      "operator": "crosses_above",
      "right": "EMA_50"
    }
  ],
  "exit_rules": [
    {
      "left": "EMA_20",
      "operator": "crosses_below",
      "right": "EMA_50"
    }
  ]
}

Rules:
- Supported indicator types: EMA, SMA, RSI, MACD, VWAP, ATR, BB, VOLUME
- Supported operators: >, <, >=, <=, crosses_above, crosses_below
- Name format: TYPE_PERIOD (e.g., EMA_20, RSI_14, SMA_50)
- EMA/SMA/BB/VWAP → panel:"main". RSI/MACD/ATR/VOLUME → panel:"sub"
- VOLUME rule right side: use "VOLUME_SMA_20" for "above average volume"
- Default colors by type:
  EMA → "#2196F3", SMA → "#FF9800", RSI → "#9C27B0",
  MACD → "#00BCD4", BB → "#607D8B", VWAP → "#E91E63",
  ATR → "#795548", VOLUME → "#9E9E9E"
- Always include all indicators referenced in rules
- temperature must be 0.1
`;

const STRICT_SUFFIX = `
\n\nIMPORTANT: Respond with ONLY the raw JSON object. No markdown, no code fences, no commentary, no extra text before or after. The entire response must be directly parseable by JSON.parse().`;

function extractJson(text: string): StrategyJSON | null {
  let cleaned = (text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```(?:json)?/gi, "").trim();
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return parsed as StrategyJSON;
    }
  } catch {
    return null;
  }
  return null;
}

async function callOpenRouter(model: string, system: string, user: string, temperature: number): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://quartly.vercel.app",
      "X-Title": "Quartly Bot",
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API error: ${res.status}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data?.choices?.[0]?.message?.content || "";
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
  }
  const model = typeof body.model === "string" && body.model ? body.model : DEFAULT_MODEL;

  try {
    let content = await callOpenRouter(model, SYSTEM_PROMPT, prompt, 0.1);
    let strategy = extractJson(content);

    if (!strategy) {
      // Reintenta una vez con un prompt más estricto.
      content = await callOpenRouter(model, SYSTEM_PROMPT + STRICT_SUFFIX, prompt, 0.1);
      strategy = extractJson(content);
    }

    if (!strategy) {
      return NextResponse.json(
        { ok: false, error: "No se pudo interpretar la estrategia. Intenta ser más específico." },
        { status: 422 }
      );
    }

    return NextResponse.json(strategy);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}