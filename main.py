"""
main.py — EarningsAI Quant (AI Strategy Visualizer)
Backend FastAPI del repo EarningsAI. Levanta el router /api/strategy con CORS
para el frontend en localhost:3000 y el dominio de producción en Vercel.

Ejecutar:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import strategy

app = FastAPI(
    title="EarningsAI Quant — AI Strategy Visualizer API",
    version="0.1.0",
    description=(
        "Convierte lenguaje natural en estrategias de trading, calcula indicadores "
        "técnicos (EMA/SMA/RSI/MACD/BB/ATR/VWAP/VOLUME) y detecta señales."
    ),
)

_vercel_production = (
    os.environ.get("NEXT_PUBLIC_APP_URL") or "https://quartly.vercel.app"
).rstrip("/")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://quartly.vercel.app",
    "https://earnings-ai.vercel.app",
]

if _vercel_production and _vercel_production not in origins:
    origins.append(_vercel_production)

vercel_url = os.environ.get("VERCEL_URL")
if vercel_url:
    origins.append(f"https://{vercel_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strategy.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "earningsai-quant"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)