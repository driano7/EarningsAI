"""
app/services/data_fetcher.py — EarningsAI Quant
Obtiene datos OHLCV para el Strategy Visualizer.

Fuentes (reutilizando APIs que ya usa el repo Next.js):
- Acciones / ETFs: Finnhub `/stock/candle`.
- Cripto: CoinGecko `/coins/{id}/market_chart` + `/search` (fallback de ID).

El contrato de salida siempre es: list[dict{time, open, high, low, close, volume}]
con `time` como timestamp Unix en segundos (int).
"""

from __future__ import annotations

import math
import os
import time
from typing import Any

import httpx

FINNHUB_BASE = "https://finnhub.io/api/v1"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
TWELVE_BASE = "https://api.twelvedata.com"

TIMEOUT = 20

TWELVE_INTERVALS: dict[str, str] = {
    "1m": "1min", "1": "1min",
    "5m": "5min", "5": "5min",
    "15m": "15min", "15": "15min",
    "30m": "30min", "30": "30min",
    "60m": "1h", "1h": "1h", "60": "1h",
    "D": "1day", "1d": "1day", "day": "1day",
    "W": "1week", "1w": "1week", "week": "1week",
    "M": "1month", "1M": "1month", "month": "1month",
}

RESOLUTIONS: dict[str, str] = {
    "1m": "1", "1": "1",
    "5m": "5", "5": "5",
    "15m": "15", "15": "15",
    "30m": "30", "30": "30",
    "60m": "60", "1h": "60", "60": "60",
    "D": "D", "1d": "D", "day": "D",
    "W": "W", "1w": "W", "week": "W",
    "M": "M", "1M": "M", "month": "M",
}

RESOLUTION_SECONDS = {"1": 60, "5": 300, "15": 900, "30": 1800, "60": 3600,
                      "D": 86400, "W": 604800, "M": 2592000}

# Mismo mapeo de ticker → CoinGecko id que lib/coingecko.ts.
CRYPTO_IDS: dict[str, str] = {
    "BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana", "ADA": "cardano",
    "DOT": "polkadot", "AVAX": "avalanche-2", "MATIC": "matic-network",
    "LINK": "chainlink", "UNI": "uniswap", "ATOM": "cosmos", "XRP": "ripple",
    "BNB": "binancecoin", "DOGE": "dogecoin", "LTC": "litecoin", "TRX": "tron",
    "NEAR": "near", "APT": "aptos", "ARB": "arbitrum", "OP": "optimism",
    "SUI": "sui", "INJ": "injective-protocol", "TIA": "celestia",
    "SEI": "sei-network", "AKT": "akash-network", "FET": "fetch-ai",
    "RNDR": "render-token", "FIL": "filecoin", "ICP": "internet-computer",
    "HBAR": "hedera-hashgraph", "VET": "vechain", "ALGO": "algorand",
    "FTM": "fantom", "EOS": "eos", "ZIL": "zilliqa", "THETA": "theta-token",
    "GRT": "the-graph", "SAND": "the-sandbox", "MANA": "decentraland",
    "AAVE": "aave", "MKR": "maker", "COMP": "compound-governance-token",
    "YFI": "yearn-finance", "SNX": "havven", "SUSHI": "sushi",
    "CRV": "curve-dao-token", "BAL": "balancer", "CAKE": "pancakeswap-token",
    "RUNE": "thorchain",
}


def _finnhub_key() -> str:
    key = os.environ.get("FINNHUB_API_KEY") or ""
    if not key:
        raise ValueError("FINNHUB_API_KEY no está configurada en .env.local.")
    return key.strip()


def _request(url: str, *, needs_api_key: bool = False) -> dict[str, Any] | list[Any]:
    params: dict[str, str] = {}
    if needs_api_key:
        params["token"] = _finnhub_key()
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(url, params=params or None)
    if resp.status_code == 429:
        raise RuntimeError("Límite de peticiones a la API de datos alcanzado (429).")
    if resp.status_code >= 400:
        raise RuntimeError(f"API de datos respondió {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    return data if isinstance(data, (dict, list)) else {}


def _resolution_and_seconds(interval: str) -> tuple[str, int]:
    res = RESOLUTIONS.get(interval.lower()) or "D"
    return res, RESOLUTION_SECONDS[res]


def _twelve_key() -> str:
    return (os.environ.get("TWELVE") or "").strip()


def _parse_twelve_datetime(dt_str: str) -> int:
    """Convierte 'YYYY-MM-DD' o 'YYYY-MM-DD HH:MM:SS' a timestamp Unix (UTC)."""
    from datetime import datetime, timezone

    s = dt_str.strip()
    try:
        if len(s) == 10:
            return int(
                datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
            )
        return int(
            datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
            .replace(tzinfo=timezone.utc)
            .timestamp()
        )
    except ValueError:
        return 0


def _twelve_ohlcv(ticker: str, interval: str, bars: int) -> list[dict[str, Any]]:
    key = _twelve_key()
    if not key:
        raise RuntimeError("TWELVE (Twelve Data API key) no configurada.")
    iv = TWELVE_INTERVALS.get(interval.lower(), "1day")
    outsize = min(max(bars, 5), 500)
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(
            f"{TWELVE_BASE}/time_series",
            params={"symbol": ticker, "interval": iv, "outputsize": outsize, "apikey": key},
        )
    data = resp.json()
    if resp.status_code != 200 or not isinstance(data, dict) or data.get("status") == "error":
        detail = data.get("message") if isinstance(data, dict) else ""
        raise RuntimeError(f"TwelveData respondió {resp.status_code}: {detail or resp.text[:200]}")

    values = data.get("values") or []
    if not values:
        raise RuntimeError(f"TwelveData sin datos para {ticker}.")

    rows: list[dict[str, Any]] = []
    for bar in reversed(values):  # API devuelve las más recientes primero
        rows.append(
            {
                "time": _parse_twelve_datetime(bar.get("datetime", "")),
                "open": float(bar.get("open", 0) or 0),
                "high": float(bar.get("high", 0) or 0),
                "low": float(bar.get("low", 0) or 0),
                "close": float(bar.get("close", 0) or 0),
                "volume": float(bar.get("volume", 0) or 0),
            }
        )
    return rows[:bars]


def _stock_ohlcv(ticker: str, interval: str, bars: int) -> list[dict[str, Any]]:
    # Primero Twelve Data (key ya usada por el repo); fallback a Finnhub.
    try:
        return _twelve_ohlcv(ticker, interval, bars)
    except RuntimeError:
        pass

    res, seconds = _resolution_and_seconds(interval)
    to = int(time.time())
    from_ts = to - bars * seconds
    data = _request(
        f"{FINNHUB_BASE}/stock/candle?symbol={ticker}&resolution={res}"
        f"&from={from_ts}&to={to}",
        needs_api_key=True,
    )
    if not isinstance(data, dict) or data.get("s") != "ok":
        raise ValueError(f"No se obtuvieron velas para {ticker} (TwelveData/Finnhub).")

    times = data.get("t") or []
    opens = data.get("o") or []
    highs = data.get("h") or []
    lows = data.get("l") or []
    closes = data.get("c") or []
    volumes = data.get("v") or []

    rows: list[dict[str, Any]] = []
    for i, t in enumerate(times):
        rows.append(
            {
                "time": int(t),
                "open": opens[i],
                "high": highs[i],
                "low": lows[i],
                "close": closes[i],
                "volume": volumes[i] if i < len(volumes) else 0.0,
            }
        )
    return rows[-bars:]


def _coingecko_coin_id(ticker: str) -> str | None:
    direct = CRYPTO_IDS.get(ticker)
    if direct:
        return direct
    try:
        data = _request(f"{COINGECKO_BASE}/search?query={ticker}")
        if isinstance(data, dict):
            for coin in data.get("coins") or []:
                if str(coin.get("symbol", "")).upper() == ticker:
                    return coin.get("id")
    except RuntimeError:
        return None
    return None


def _crypto_ohlcv(ticker: str, interval: str, bars: int) -> list[dict[str, Any]]:
    _, seconds = _resolution_and_seconds(interval)
    coin_id = _coingecko_coin_id(ticker)
    if not coin_id:
        raise ValueError(f"No se encontró el par cripto para {ticker} en CoinGecko.")

    days = max(1, min(365, math.ceil(bars * seconds / 86400)))
    data = _request(
        f"{COINGECKO_BASE}/coins/{coin_id}/market_chart"
        f"?vs_currency=usd&days={days}"
    )
    if not isinstance(data, dict):
        raise ValueError(f"CoinGecko no devolvió datos para {ticker}.")

    prices: list[tuple[int, float]] = []
    for item in (data.get("prices") or []):
        if len(item) >= 2:
            prices.append((int(item[0] // 1000), float(item[1])))

    volumes: dict[int, float] = {}
    for item in (data.get("total_volumes") or []):
        if len(item) >= 2:
            t = int(item[0] // 1000)
            volumes[t - (t % seconds)] = float(item[1])

    buckets: dict[int, dict[str, float]] = {}
    for t, price in prices:
        b = t - (t % seconds)
        if b not in buckets:
            buckets[b] = {"open": price, "high": price, "low": price, "close": price}
        else:
            bucket = buckets[b]
            bucket["high"] = max(bucket["high"], price)
            bucket["low"] = min(bucket["low"], price)
            bucket["close"] = price

    rows: list[dict[str, Any]] = []
    for b in sorted(buckets)[-bars:]:
        row = buckets[b]
        rows.append(
            {
                "time": int(b),
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": volumes.get(b, 0.0),
            }
        )
    return rows


def fetch_ohlcv(
    ticker: str, asset_type: str = "stock", interval: str = "D", bars: int = 120
) -> list[dict[str, Any]]:
    """Obtiene datos OHLCV para acciones/ETFs (Finnhub) o cripto (CoinGecko)."""
    try:
        bars = int(bars)
    except (TypeError, ValueError):
        bars = 120
    bars = max(5, min(bars, 500))

    ticker = (ticker or "").strip().upper()
    if not ticker:
        raise ValueError("Falta el ticker.")

    asset_type = (asset_type or "stock").lower()
    if asset_type in ("crypto", "cr", "coin", "cryptocurrency"):
        return _crypto_ohlcv(ticker, interval, bars)
    return _stock_ohlcv(ticker, interval, bars)