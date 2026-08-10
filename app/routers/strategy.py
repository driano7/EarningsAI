"""
app/routers/strategy.py — EarningsAI Quant
Endpoints del AI Strategy Visualizer:
- POST /api/strategy/parse         (lenguaje natural → StrategyJSON)
- POST /api/strategy/calculate     (data_fetcher → indicator_engine → signal_detector)
- POST /api/strategy/chat-modify   (modificar la estrategia por chat)
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
import httpx
from pydantic import BaseModel, Field

from app.services import ai_parser, data_fetcher, indicator_engine, signal_detector

router = APIRouter(prefix="/api/strategy", tags=["strategy"])

CHAT_MODIFY_SYSTEM_PROMPT = """You are a trading chart assistant. The user has an active strategy rendered on a chart.
They want to modify it via natural language.

You will receive:
1. current_strategy: the existing StrategyJSON
2. user_message: what the user wants to change

You must return ONLY a valid JSON with this structure:
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
- temperature: 0.2"""


class ParseRequest(BaseModel):
    prompt: str
    model: str = ai_parser.DEFAULT_MODEL


class IndicatorSpec(BaseModel):
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    color: str = "var(--brand-strong)"
    panel: str = "main"

    @classmethod
    def _default_panel(cls, indicator_type: str) -> str:
        return "main" if indicator_type.upper() in ("EMA", "SMA", "BB", "VWAP") else "sub"

    def model_post_init(self, __context: Any) -> None:
        self.panel = (
            self.panel
            if self.panel in ("main", "sub")
            else self._default_panel(self.type)
        )


class RuleSpec(BaseModel):
    left: str
    operator: str
    right: str


class StrategyJSON(BaseModel):
    indicators: list[IndicatorSpec] = Field(default_factory=list)
    entry_rules: list[RuleSpec] = Field(default_factory=list)
    exit_rules: list[RuleSpec] = Field(default_factory=list)

    def to_plain(self) -> dict[str, Any]:
        return {
            "indicators": [i.model_dump() for i in self.indicators],
            "entry_rules": [r.model_dump() for r in self.entry_rules],
            "exit_rules": [r.model_dump() for r in self.exit_rules],
        }


class CalculateRequest(BaseModel):
    ticker: str
    asset_type: str = "stock"
    interval: str = "D"
    bars: int = 120
    strategy: StrategyJSON


class ChatModifyRequest(BaseModel):
    current_strategy: StrategyJSON
    user_message: str
    model: str = ai_parser.DEFAULT_MODEL


def _or_chat_json(model: str, system: str, user: str, temperature: float) -> dict[str, Any]:
    """Llama a OpenRouter y devuelve un dict JSON, o lanza HTTPException."""
    import os

    key = os.environ.get("OPENROUTER_API_KEY") or ""
    if not key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY no configurada.")

    payload = {
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
    try:
        with httpx.Client(timeout=45) as client:
            resp = client.post(ai_parser.OPENROUTER_URL, json=payload, headers=headers)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Error llamando a OpenRouter: {exc}") from exc

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502, detail=f"OpenRouter respondió {resp.status_code}: {resp.text[:400]}"
        )
    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="OpenRouter sin contenido válido.")

    parsed = ai_parser._extract_json(content)  # noqa: SLF001 - utilidad compartida
    if parsed is None:
        raise HTTPException(status_code=502, detail="El modelo no devolvió JSON válido.")
    return parsed


@router.post("/parse")
def parse_strategy(req: ParseRequest) -> dict[str, Any]:
    """Convierte una instrucción en lenguaje natural a un StrategyJSON."""
    try:
        return ai_parser.parse_strategy_prompt(req.prompt, req.model)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/calculate")
def calculate_strategy(req: CalculateRequest) -> dict[str, Any]:
    """Descarga OHLCV, calcula indicadores y detecta señales de entrada/salida."""
    try:
        ohlcv = data_fetcher.fetch_ohlcv(
            req.ticker, req.asset_type, req.interval, req.bars
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    spec = req.strategy.to_plain()
    if not ohlcv:
        raise HTTPException(status_code=404, detail=f"Sin datos OHLCV para {req.ticker}.")
    if not spec["indicators"]:
        return {"ohlcv": ohlcv, "series": [], "signals": []}

    try:
        series = indicator_engine.calculate_indicators(ohlcv, spec["indicators"])
        signals = signal_detector.detect_signals(
            ohlcv, series, spec["entry_rules"], spec["exit_rules"]
        )
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"ohlcv": ohlcv, "series": series, "signals": signals}


@router.post("/chat-modify")
def chat_modify(req: ChatModifyRequest) -> dict[str, Any]:
    """Modifica la estrategia actual según un mensaje del usuario en lenguaje natural."""
    user_payload = json.dumps(
        {
            "current_strategy": req.current_strategy.to_plain(),
            "user_message": req.user_message,
        },
        ensure_ascii=False,
    )
    result = _or_chat_json(req.model, CHAT_MODIFY_SYSTEM_PROMPT, user_payload, 0.2)

    updated = result.get("updated_strategy")
    if not isinstance(updated, dict):
        raise HTTPException(status_code=502, detail="updated_strategy ausente en la respuesta.")
    # Normaliza a StrategyJSON para devolver siempre la estructura completa.
    try:
        normalized = StrategyJSON.model_validate(updated)
        serialized = normalized.to_plain()
    except Exception:  # noqa: BLE001
        serialized = updated

    return {
        "action": result.get("action", "modify"),
        "updated_strategy": serialized,
        "explanation": result.get("explanation", ""),
    }