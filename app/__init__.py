"""
EarningsAI Quant — FastAPI backend (AI Strategy Visualizer).

Carga variables locales desde `.env.local` (double-quoted values are handled)
para que el backend pueda reutilizar las API keys del repo sin configuración extra.
"""

import os
from pathlib import Path


def _load_local_env() -> None:
    """Carga .env.local si existe; tolera valores con comillas dobles."""
    path = Path.cwd() / ".env.local"
    if not path.exists():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(path, override=False)
    except Exception:  # noqa: BLE001 - dotenv es opcional en producción
        pass
    # dotenv maneja comillas, pero por seguridad limpiamos comillas sobrantes.
    for key, value in list(os.environ.items()):
        if value.startswith('"') and value.endswith('"') and len(value) >= 2:
            os.environ[key] = value[1:-1]


_load_local_env()