/*
 * Quartly Bot — app/api/strategy/chat-modify/route.ts
 * AI Strategy Visualizer — modifica una estrategia activa por chat via OpenRouter.
 * Copyright (c) Donovan Riaño. All rights reserved.
 */

import { NextRequest, NextResponse } from "next/server";
import type { StrategyJSON } from "@/lib/strategy-types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `
You are a trading chart assistant for Quartly, a financial analysis app.
The user has an active trading strategy displayed on a chart and wants to modify it.

You receive:
- current_strategy: the existing StrategyJSON
- user_message: what the user wants to change

Return ONLY valid JSON — no markdown, no explanation, no code blocks — with this exact schema:
{
  "action": "modify" | "add_indicator" | "remove_indicator" | "change_color" | "change_period" | "add_rule" | "remove_rule" | "reset",
  "updated_strategy": { ...full updated StrategyJSON... },
  "explanation": "short human-readable explanation of what changed"
}

Rules:
- Always return the COMPLETE updated_strategy, not just the diff
- If action is "reset", return a blank strategy with empty arrays
- For color changes, use CSS vars: var(--brand-strong), var(--accent-strong),
  var(--success-strong), var(--warning-strong), var(--danger-strong)
- Keep all existing rules unless user explicitly removes them
- Supported indicator types: EMA, SMA, RSI, MACD, VWAP, ATR, BB, VOLUME
- Supported operators: >, <, >=, <=, crosses_above, crosses_below
- Name format: TYPE_PERIOD (e.g., EMA_20, RSI_14, SMA_50)
- EMA/SMA/BB/VWAP → panel:"main". RSI/MACD/ATR/VOLUME → panel:"sub"
- temperature must be 0.2`;

interface ChatModifyResult {
  action: string;
  updated_strategy: StrategyJSON;
  explanation: string;
}

function extractJson(text: string): ChatModifyResult | null {
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
    if (parsed && typeof parsed === "object" && parsed.updated_strategy) {
      return parsed as ChatModifyResult;
    }
  } catch {
    return null;
  }
  return null;
}

function defaultPanel(type: string): "main" | "sub" {
  return type === "EMA" || type === "SMA" || type === "BB" || type === "VWAP" ? "main" : "sub";
}

function normalizeStrategy(json: Partial<StrategyJSON>): StrategyJSON {
  const indicators = Array.isArray(json.indicators)
    ? json.indicators.map((ind) => ({
        type: ind.type,
        params: ind.params ?? {},
        color: ind.color ?? "#2196F3",
        panel: ind.panel === "sub" || ind.panel === "main" ? ind.panel : defaultPanel(ind.type),
      }))
    : [];
  const entry_rules = Array.isArray(json.entry_rules) ? json.entry_rules : [];
  const exit_rules = Array.isArray(json.exit_rules) ? json.exit_rules : [];
  return { indicators, entry_rules, exit_rules };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    current_strategy?: StrategyJSON;
    user_message?: string;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const userMessage = typeof body.user_message === "string" ? body.user_message.trim() : "";
  if (!userMessage) {
    return NextResponse.json({ ok: false, error: "user_message is required" }, { status: 400 });
  }
  const currentStrategy = Array.isArray(body.current_strategy?.indicators)
    ? (body.current_strategy as StrategyJSON)
    : { indicators: [], entry_rules: [], exit_rules: [] };
  const model = typeof body.model === "string" && body.model ? body.model : DEFAULT_MODEL;

  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  try {
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({ current_strategy: currentStrategy, user_message: userMessage }),
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `OpenRouter API error: ${res.status}` }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content || "";
    const result = extractJson(content);

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "No se pudo interpretar la modificación. Intenta reformular." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      action: result.action ?? "modify",
      updated_strategy: normalizeStrategy(result.updated_strategy),
      explanation: typeof result.explanation === "string" ? result.explanation : "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}