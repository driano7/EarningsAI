"""
app/services/ai_parser.py — EarningsAI Quant
Convierte instrucciones en lenguaje natural a un StrategyJSON estricto via OpenRouter.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-4o-mini"
REQUEST_TIMEOUT = 45

SYSTEM_PROMPT = """You are a trading strategy parser. Convert natural language into a strict JSON object.
Output ONLY valid JSON with this exact schema:

{
  "indicators": [
    {
      "type": "EMA" | "SMA" | "RSI" | "MACD" | "VWAP" | "ATR" | "BB" | "VOLUME",
      "params": { "period": number },
      "color": "var(--brand-strong)",
      "panel": "main" | "sub"
    }
  ],
  "entry_rules": [
    {
      "left": "EMA_20",
      "operator": ">" | "<" | ">=" | "<=" | "crosses_above" | "crosses_below",
      "right": "EMA_50" | "70" | "VOLUME_SMA_20"
    }
  ],
  "exit_rules": [...same as entry_rules]
}

Rules:
- EMA, SMA, BB, VWAP → panel: "main"
- RSI, MACD, ATR, VOLUME → panel: "sub"
- Always name indicators as TYPE_PERIOD (e.g., EMA_20, RSI_14)
- Default colors: EMA→"#2196F3", SMA→"#FF9800", RSI→"#9C27B0",
  MACD→"#00BCD4", BB→"#607D8B", VWAP→"#E91E63", ATR→"#795548"
- temperature: 0.1
- response_format: json_object"""

STRICTER_SUFFIX = (
    "\n\nSTRICTER REQUIREMENT: Respond with ONLY the raw JSON object. "
    "No markdown code fences (no ```), no code blocks, no extra text before or after. "
    "The entire response must be directly parseable by json.loads()."
)


def _api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY") or ""
    if not key:
        raise ValueError(
            "OPENROUTER_API_KEY no está configurada. Añádela en .env.local del repo."
        )
    return key.strip()


def _chat(system: str, user: str, model: str, temperature: float) -> str:
    key = _api_key()
    payload: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://quartly.vercel.app",
    }
    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        resp = client.post(OPENROUTER_URL, json=payload, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError(
            f"OpenRouter respondió {resp.status_code}: {resp.text[:500]}"
        )
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Respuesta de OpenRouter sin contenido válido: {data!r}") from exc


def _extract_json(text: str) -> dict[str, Any] | None:
    """Extrae el primer objeto JSON de la respuesta, tolerando code fences y texto extra."""
    if not text:
        return None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1] if "```" in cleaned[3:] else cleaned
        cleaned = cleaned.strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        obj = json.loads(cleaned)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass

    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(cleaned[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def parse_strategy_prompt(prompt: str, model: str = DEFAULT_MODEL) -> dict[str, Any]:
    """
    Convierte `prompt` (lenguaje natural) en un StrategyJSON (dict).

    - Llama a OpenRouter con el system prompt EXACTO y formato JSON.
    - Si la primera respuesta no es JSON válido, reintenta una vez con un prompt más estricto.
    """
    for attempt in range(2):
        system = SYSTEM_PROMPT
        if attempt == 1:
            system = SYSTEM_PROMPT + STRICTER_SUFFIX

        content = _chat(system, prompt, model=model, temperature=0.1)
        parsed = _extract_json(content)
        if parsed is not None:
            return parsed

    raise ValueError(
        "El modelo no devolvió JSON válido tras 2 intentos. Prueba reformulando la "
        "instrucción o cambiando el modelo."
    )