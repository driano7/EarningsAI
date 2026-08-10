"""
app/services/signal_detector.py — EarningsAI Quant
Detecta señales de compra/venta evaluando entry_rules y exit_rules barra por barra.
"""

from __future__ import annotations

from typing import Any

OPERATOR_LABELS = {
    ">": "mayor que",
    "<": "menor que",
    ">=": "mayor o igual que",
    "<=": "menor o igual que",
    "crosses_above": "cruza por arriba de",
    "crosses_below": "cruza por debajo de",
}


def _resolve(key: Any, lookup: dict[str, dict[int, float]], t: int) -> float | None:
    """Si `key` es un indicador, devuelve su valor en `t`; si no, intenta parsearlo como float."""
    if isinstance(key, str) and key in lookup:
        return lookup[key].get(t)
    try:
        return float(key)
    except (TypeError, ValueError):
        return None


def _rule_matches(rule: dict[str, Any], lookup: dict[str, dict[int, float]], t: int, t_prev: int) -> bool:
    operator = str(rule.get("operator") or "")
    left_cur = _resolve(rule.get("left"), lookup, t)
    right_cur = _resolve(rule.get("right"), lookup, t)

    if any(v is None for v in (left_cur, right_cur)):
        return False

    if operator in (">", "<", ">=", "<="):
        if operator == ">":
            return left_cur > right_cur
        if operator == "<":
            return left_cur < right_cur
        if operator == ">=":
            return left_cur >= right_cur
        return left_cur <= right_cur

    if operator in ("crosses_above", "crosses_below"):
        left_prev = _resolve(rule.get("left"), lookup, t_prev)
        right_prev = _resolve(rule.get("right"), lookup, t_prev)
        if left_prev is None or right_prev is None:
            return False
        if operator == "crosses_above":
            return left_prev <= right_prev and left_cur > right_cur
        return left_prev >= right_prev and left_cur < right_cur

    return False


def _rule_text(rule: dict[str, Any]) -> str:
    operator = str(rule.get("operator") or "")
    label = OPERATOR_LABELS.get(operator, operator)
    return f"{rule.get('left')} {label} {rule.get('right')}"


def _reason(kind: str, rules: list[dict[str, Any]]) -> str:
    return f"{kind}: " + " y ".join(_rule_text(r) for r in rules)


def detect_signals(
    ohlcv: list[dict[str, Any]],
    series: list[dict[str, Any]],
    entry_rules: list[dict[str, Any]],
    exit_rules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Evalúa todas las reglas (entry y exit) barra por barra.

    Por barra (i desde 1 hasta len-1): si TODAS las entry_rules se cumplen se emite
    un "buy"; si TODAS las exit_rules se cumplen se emite un "sell".
    """
    lookup: dict[str, dict[int, float]] = {}
    for s in series:
        name = s.get("name")
        if not name:
            continue
        lookup[name] = {int(p["time"]): p["value"] for p in s.get("data", [])}

    signals: list[dict[str, Any]] = []
    for i in range(1, len(ohlcv)):
        t = ohlcv[i]["time"]
        t_prev = ohlcv[i - 1]["time"]
        price = ohlcv[i]["close"]

        if entry_rules and all(
            _rule_matches(rule, lookup, t, t_prev) for rule in entry_rules
        ):
            signals.append(
                {
                    "time": t,
                    "type": "buy",
                    "price": price,
                    "reason": _reason("Entrada", entry_rules),
                }
            )

        if exit_rules and all(
            _rule_matches(rule, lookup, t, t_prev) for rule in exit_rules
        ):
            signals.append(
                {
                    "time": t,
                    "type": "sell",
                    "price": price,
                    "reason": _reason("Salida", exit_rules),
                }
            )

    return signals