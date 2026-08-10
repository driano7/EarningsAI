"""
app/services/indicator_engine.py — EarningsAI Quant
Calcula indicadores técnicos (pandas-ta) sobre una serie OHLCV y los expone
como listas de series {name, color, panel, data:[{time, value}]}.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
import pandas_ta as ta

MAIN_PANEL_TYPES = ("EMA", "SMA", "BB", "VWAP")
SUB_PANEL_TYPES = ("RSI", "MACD", "ATR", "VOLUME")

DEFAULT_COLORS: dict[str, str] = {
    "EMA": "#2196F3",
    "SMA": "#FF9800",
    "RSI": "#9C27B0",
    "MACD": "#00BCD4",
    "BB": "#607D8B",
    "VWAP": "#E91E63",
    "ATR": "#795548",
    "VOLUME": "#9E9E9E",
}


def _panel_for(indicator_type: str, declared: str | None) -> str:
    if declared and declared in ("main", "sub"):
        return declared
    return "main" if indicator_type in MAIN_PANEL_TYPES else "sub"


def _emit(name: str, values: Any, index: Any, color: str, panel: str) -> dict[str, Any]:
    """Convierte una Serie pandas a {name, color, panel, data:[{time, value}]}."""
    points = []
    for ts, val in zip(index, values):
        time = int(ts)
        if pd.isna(val) or val is None:
            value = 0.0
        else:
            value = round(float(val), 4)
        points.append({"time": time, "value": value})
    return {"name": name, "color": color, "panel": panel, "data": points}


def calculate_indicators(
    ohlcv: list[dict[str, Any]], indicators: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Calcula todos los indicadores pedidos contra el DataFrame OHLCV.

    - EMA/SMA/RSI/ATR/VWAP/VOLUME → 1 serie cada uno.
    - MACD → 2 series: MACD y MACD_SIGNAL.
    - BB → 3 series: BB_UPPER, BB_MID, BB_LOWER.
    - NaN se rellena con 0; los valores se redondean a 4 decimales.
    """
    df = pd.DataFrame(
        [{k: bar[k] for k in ("time", "open", "high", "low", "close", "volume")} for bar in ohlcv]
    )

    series: list[dict[str, Any]] = []
    for spec in indicators:
        indicator_type = str(spec.get("type") or "SMA").upper()

        try:
            period = int((spec.get("params") or {}).get("period") or 14)
        except (TypeError, ValueError):
            period = 14

        panel = _panel_for(indicator_type, spec.get("panel"))
        color = spec.get("color") or DEFAULT_COLORS.get(indicator_type, "#9E9E9E")

        if indicator_type == "EMA":
            values = ta.ema(df["close"], length=period)
            series.append(_emit(f"EMA_{period}", values, df["time"], color, panel))

        elif indicator_type == "SMA":
            values = ta.sma(df["close"], length=period)
            series.append(_emit(f"SMA_{period}", values, df["time"], color, panel))

        elif indicator_type == "RSI":
            values = ta.rsi(df["close"], length=period)
            series.append(_emit(f"RSI_{period}", values, df["time"], color, panel))

        elif indicator_type == "MACD":
            result = ta.macd(df["close"])
            if result is None or result.empty:
                continue
            main_col, signal_col = None, None
            for col in result.columns:
                name = str(col)
                if name.startswith("MACDh_"):
                    continue
                if name.startswith("MACDs_") and signal_col is None:
                    signal_col = col
                elif name.startswith("MACD_") and main_col is None:
                    main_col = col
            if main_col is not None:
                series.append(_emit("MACD", result[main_col], df["time"], color, panel))
            if signal_col is not None:
                series.append(_emit("MACD_SIGNAL", result[signal_col], df["time"], color, panel))

        elif indicator_type == "BB":
            result = ta.bbands(df["close"], length=period)
            if result is None or result.empty:
                continue
            upper, mid, lower = None, None, None
            for col in result.columns:
                name = str(col)
                if name.startswith("BBU_"):
                    upper = col
                elif name.startswith("BBM_"):
                    mid = col
                elif name.startswith("BBL_"):
                    lower = col
            if upper is not None:
                series.append(_emit("BB_UPPER", result[upper], df["time"], color, panel))
            if mid is not None:
                series.append(_emit("BB_MID", result[mid], df["time"], color, panel))
            if lower is not None:
                series.append(_emit("BB_LOWER", result[lower], df["time"], color, panel))

        elif indicator_type == "ATR":
            values = ta.atr(df["high"], df["low"], df["close"], length=period)
            series.append(_emit(f"ATR_{period}", values, df["time"], color, panel))

        elif indicator_type == "VWAP":
            dt_index = pd.to_datetime(df["time"], unit="s")
            values = ta.vwap(
                pd.Series(df["high"].to_numpy(), index=dt_index),
                pd.Series(df["low"].to_numpy(), index=dt_index),
                pd.Series(df["close"].to_numpy(), index=dt_index),
                pd.Series(df["volume"].to_numpy(), index=dt_index),
            )
            series.append(_emit("VWAP", values, df["time"], color, panel))

        elif indicator_type == "VOLUME":
            values = ta.sma(df["volume"], length=20)
            series.append(_emit("VOLUME_SMA_20", values, df["time"], color, panel))

    return series