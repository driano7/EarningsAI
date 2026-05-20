# Quartly — Telegram Earnings & Financial Intelligence Bot

---

<div align="center">

**English** | [Español](#español)

</div>

---

## Overview

Quartly is a Telegram bot that delivers earnings data, financial analysis, and market intelligence for **S&P 500 companies**, **ETFs**, and **custom tickers** (TSM, ASML, SAP, NVO, SHOP). It automatically tracks your watchlist, sends reminders before earnings reports, and generates AI-powered analysis when companies publish their quarterly results.

### Key Features

- **Watchlist Management** — Track up to 30 stocks and ETFs via Telegram inline search
- **Custom Tickers** — Add non-S&P 500 stocks (TSM, ASML, SAP, NVO, SHOP) via the same inline search
- **Earnings Reminders** — Automated alerts at 3 days, 1 day, and ~2 hours before reports
- **AI-Powered Analysis** — Natural language earnings reports in Spanish, powered by Llama 4 via OpenRouter
- **Hype Ranking** — Weekly ranking of upcoming earnings by potential (beat history + analyst sentiment + price momentum)
- **Logo Support** — Company logos displayed alongside messages via Finnhub
- **Price Tracking** — Current price, daily/weekly/monthly/yearly change, 52-week range (via Yahoo Finance)
- **EPS History** — Last 4 quarters of earnings surprises (beat/miss) for stocks
- **Analyst Signals** — Buy/Hold/Sell consensus with percentages from Finnhub recommendation trends
- **Inline Keyboard** — Remove button directly on the confirmation message for quick watchlist management

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Telegram Client                      │
│  (Inline Search, Commands, Inline Keyboard Buttons)      │
└────────────┬──────────────────────────────┬──────────────┘
             │ Webhook POST                 │ Inline Query
             ▼                              ▼
┌────────────────────────┐    ┌────────────────────────────┐
│  api/webhook.ts        │    │  api/webhook.ts            │
│  Commands: /start      │    │  Inline Query Handler      │
│  /mystocks /myetfs     │    │  Callback Handler          │
│  /report               │    │  Add Stock/ETF from search │
└────────────┬───────────┘    └────────────┬───────────────┘
             │                             │
             ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Vercel Serverless                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Cron Jobs (Mon-Fri)                              │   │
│  │  cron-morning.ts   → 6:00 AM CST (3d/1d reminders)│   │
│  │  cron-afternoon.ts → 2:00 PM CST (~2h AMC alert) │   │
│  │  cron-evening.ts   → 4:30 PM CST (AI analysis)   │   │
│  └──────────────────────────────────────────────────┘   │
└────────────┬──────────────────────────────┬──────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────┐    ┌────────────────────────────┐
│  Finnhub API (Free)    │    │  OpenRouter API (Free)     │
│  • Earnings Calendar   │    │  Model: llama-4-maverick   │
│  • EPS History         │    │  Temperature: 0.3          │
│  • Quote Data          │    │  Max tokens: 2500          │
│  • Analyst Recs        │    │  Daily limit: 25 calls     │
│  • Company Profile     │    │                            │
└────────────────────────┘    └────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Yahoo Finance (no API key)                  │
│  • Real-time quote data                                  │
│  • Historical candles (1 year)                           │
│  • Calculates: 1d, 1w, 1m, 3m, 1y changes               │
│  • 52-week high/low                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Vercel KV (Redis)                      │
│  • stocks:{chatId} → string[]                           │
│  • etfs:{chatId} → string[]                             │
│  • users → Set<chatId>                                  │
│  • reminded:{chatId}:{ticker}:{date}:{type} → boolean   │
│  • openrouter_quota → { used, resetDate }               │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology |
|---|---|
| **Runtime** | Vercel Serverless Functions (Node.js 20+) |
| **Language** | TypeScript 5.x |
| **Bot Framework** | Telegram Bot API (webhook-based) |
| **Financial Data** | Finnhub API (free tier, 60 calls/min) |
| **Price Data** | Yahoo Finance (yahoo-finance2, no API key) |
| **AI Engine** | OpenRouter API — `meta-llama/llama-4-maverick:free` |
| **Persistence** | Vercel KV (serverless Redis via @vercel/kv) |
| **Scheduling** | Vercel Cron Jobs (3 daily, Mon-Fri) |
| **Deployment** | Vercel (git push to main) |

### Project Structure

```
api/
  webhook.ts           ← Telegram webhook: commands, inline search, callbacks
  set-webhook.ts       ← One-time webhook registration endpoint
  cron-morning.ts      ← 6 AM CST: 3-day and 1-day earnings reminders
  cron-afternoon.ts    ← 2 PM CST: ~2h pre-market AMC alerts
  cron-evening.ts      ← 4:30 PM CST: AI analysis + weekly hype ranking
lib/
  finnhub.ts           ← Finnhub API client (earnings, quotes, recommendations)
  yahoo.ts             ← Yahoo Finance price data (historical + real-time)
  openrouter.ts        ← AI report generation with section-delimited parsing
  telegram.ts          ← Message sending with logo/photo + inline keyboard support
  kv.ts                ← Vercel KV operations (watchlists, users, reminders)
  sp500.ts             ← 500 S&P 500 companies (ticker, name, sector)
  etfs.ts              ← 36 ETFs across 6 categories
  custom-tickers.ts    ← Non-S&P 500 tickers (TSM, ASML, SAP, NVO, SHOP)
  price.ts             ← Price block formatting (changes, 52-week range)
  quota.ts             ← Daily OpenRouter quota management (25/day limit)
  hype.ts              ← Hype ranking builder (surprise + analysts + momentum)
  logo.ts              ← Logo resolution (Finnhub for stocks, CDN for ETFs)
vercel.json            ← Cron job schedule configuration
.env                   ← Environment variables (not committed)
```

---

## License

All source code in this repository is **Copyright (c) Donovan Riaño. All rights reserved.**

Use, modification, or distribution of this code requires **prior written authorization** from the owner. Unauthorized use is prohibited.

---

## Requirements

### Accounts & API Keys

| Service | What You Need | Cost |
|---|---|---|
| **Telegram** | Bot token from @BotFather | Free |
| **Finnhub** | API key from finnhub.io | Free tier (60 calls/min) |
| **OpenRouter** | API key from openrouter.ai | Free (llama-4-maverick:free) |
| **Vercel** | Account for deployment + KV store | Free tier available |
| **Yahoo Finance** | No account needed | Free (yahoo-finance2 library) |

### Environment Variables

```env
FINNHUB_API_KEY=your_finnhub_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id_for_testing
OPENROUTER_API_KEY=your_openrouter_key
KV_REST_API_URL=https://xxxx.upstash.io
KV_REST_API_TOKEN=your_kv_token
```

---

## Setup

### 1. Create the Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`, follow prompts
   - **Name:** `Quartly`
   - **Username:** `QuartlyBot`
3. Save the **TOKEN** returned
4. Enable inline mode: send `/setinline` to BotFather, select your bot
5. Set bot commands: send `/setcommands`, select your bot, paste:
   ```
   start - Welcome and how to use Quartly
   mystocks - View and remove stocks from your watchlist
   myetfs - View and remove ETFs from your watchlist
   report - Manual report of your favorites now
   ```

### 2. Get Your Chat ID

1. Send any message to your bot
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Copy the value from `message.chat.id`

### 3. Get Finnhub API Key

1. Go to [finnhub.io](https://finnhub.io) → Sign up (free)
2. Dashboard → API Keys → copy your key

### 4. Get OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai) → Sign up
2. Keys → copy your API key
3. The model `meta-llama/llama-4-maverick:free` requires no balance

### 5. Set Up Vercel KV

1. Vercel Dashboard → Storage → Create → KV
2. Name: `quartly-kv` → connect to your project
3. Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### 6. Configure Environment Variables

In Vercel → Settings → Environment Variables, add all 6 variables from the `.env` file.

### 7. Deploy

```bash
git add .
git commit -m "Initial commit: Quartly bot"
git push origin main
```

Vercel will automatically build and deploy.

### 8. Activate the Webhook

Visit this URL **once** after deployment:

```
https://your-project.vercel.app/api/set-webhook
```

Expected response: `{"ok":true}`

---

## Usage

### Adding Assets to Your Watchlist

Use **inline search** in any Telegram chat:

```
@QuartlyBot AAPL
@QuartlyBot Apple
@QuartlyBot QQQ
@QuartlyBot TSM
@QuartlyBot ASML
```

Results show `[TICKER] Company Name — Sector`. Tap a result to add it to your watchlist. You'll receive a confirmation message with:

- Current price (from Yahoo Finance)
- Price changes: 1 day, 1 week, 1 month, 3 months, 1 year
- 52-week range
- EPS history (last 4 quarters, stocks only)
- Analyst signal with percentages
- Next earnings date
- Company logo (when available)
- A **[🗑️ Eliminar de favoritos]** button for quick removal

### Commands

| Command | Description |
|---|---|
| `/start` | Welcome message with bot explanation |
| `/mystocks` | List your tracked stocks with remove buttons |
| `/myetfs` | List your tracked ETFs with remove buttons |
| `/report` | Generate an immediate analysis of your favorites (AI if quota available, otherwise raw data) |

### Automated Cron Jobs

| Time (CST) | Trigger | What Happens |
|---|---|---|
| **6:00 AM** (Mon-Fri) | `cron-morning` | Sends reminders for earnings in 3 days (simple) and 1 day (detailed with price) |
| **2:00 PM** (Mon-Fri) | `cron-afternoon` | Alerts ~2h before AMC (after-market-close) earnings with price + estimates |
| **4:30 PM** (Mon-Fri) | `cron-evening` | Generates AI analysis for any of your favorites that reported today + weekly hype ranking |

### Limits

- **Watchlist:** 30 assets max (stocks + ETFs combined)
- **AI Analysis:** 25 per day (resets automatically at midnight)
- **Finnhub:** 60 API calls per minute (free tier)
- When quota is exhausted, raw Finnhub data is still sent (price, EPS estimate, analyst signal)

---

## How It Works

### Inline Search Flow

1. User types `@QuartlyBot <query>` in any Telegram chat
2. Bot searches SP500, custom tickers, and ETFs (by ticker and name)
3. Returns top 10 results as `InlineQueryResultArticle`
4. When user selects a result, a marker text (`QUARTLY_ADD_STOCK:TICKER`, `QUARTLY_ADD_ETF:TICKER`, or `QUARTLY_ADD_CUSTOM:TICKER`) is sent to the bot
5. Bot validates watchlist limit (30), adds to KV, fetches financial data from Yahoo Finance + Finnhub, and sends a formatted message with logo and inline keyboard remove button

### Earnings Reminder Flow

1. Cron job fetches earnings calendar from Finnhub for today + 7 days
2. For each user, filters their watchlist against the calendar
3. Checks anti-duplicate KV keys (`reminded:{chatId}:{ticker}:{date}:{type}`)
4. Sends formatted reminders at the appropriate intervals (3d, 1d, 2h)

### AI Analysis Flow (Evening Cron)

1. Fetches today's earnings calendar, filters to companies with `actual !== null` (already reported)
2. Cross-references with all users' watchlists to find which favorites reported
3. Builds `CompanyData` objects with EPS history, analyst signals, price
4. Builds `HypeRanking` from upcoming 7-day earnings (score = avg surprise × 0.5 + buy ratio × 30 + price change 1m × 0.2)
5. Checks daily OpenRouter quota (25/day)
6. If quota available: sends batch to Llama 4 with structured system prompt, parses response using `---SECTION:TICKER---` delimiters
7. Distributes individual company analyses to each user who tracks that stock (with logo)
8. Sends hype ranking message to all users

### Price Data Flow

1. **Yahoo Finance** (primary) — `yahoo-finance2` fetches real-time quote + 1 year of historical daily candles
2. Calculates percentage changes for 1w (5 trading days), 1m (21 days), 3m (63 days), 1y (252 days)
3. **Finnhub** (fallback) — used for 52-week high/low and daily change if Yahoo fails
4. Both sources are queried in parallel; Yahoo data takes priority

---

<br><br>

---

<div id="español"></div>

<div align="center">

[English](#overview) | **Español**

</div>

---

## Descripción

Quartly es un bot de Telegram que entrega datos de earnings, análisis financiero e inteligencia de mercado para **empresas del S&P 500**, **ETFs** y **tickers personalizados** (TSM, ASML, SAP, NVO, SHOP). Rastrea automáticamente tu watchlist, envía recordatorios antes de los reportes trimestrales y genera análisis con IA cuando las empresas publican sus resultados.

### Funcionalidades Principales

- **Gestión de Watchlist** — Rastrea hasta 30 acciones y ETFs mediante búsqueda inline de Telegram
- **Tickers Personalizados** — Agrega acciones fuera del S&P 500 (TSM, ASML, SAP, NVO, SHOP) con la misma búsqueda inline
- **Recordatorios de Earnings** — Alertas automáticas a 3 días, 1 día y ~2 horas antes de reportes
- **Análisis con IA** — Reportes de earnings en lenguaje natural en español, potenciados por Llama 4 vía OpenRouter
- **Hype Ranking** — Ranking semanal de próximos earnings por potencial (historial de beats + sentimiento de analistas + momentum de precio)
- **Soporte de Logos** — Logos de empresas mostrados junto a los mensajes vía Finnhub
- **Seguimiento de Precios** — Precio actual, variaciones (1d, 1s, 1m, 3m, 1a), rango de 52 semanas (vía Yahoo Finance)
- **Historial EPS** — Últimos 4 trimestres de sorpresas de ganancias (beat/miss) para acciones
- **Señal de Analistas** — Consenso Comprar/Mantener/Vender con porcentajes de Finnhub
- **Botón Inline** — Botón de eliminar directamente en el mensaje de confirmación

---

## Arquitectura

El bot opera completamente sin frontend, usando **Vercel Serverless Functions** como backend. Telegram envía webhooks POST al endpoint `/api/webhook` cuando hay mensajes, búsquedas inline o callbacks. Tres **Cron Jobs** se ejecutan de lunes a viernes para enviar recordatorios y análisis automáticos.

### Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Runtime** | Vercel Serverless Functions (Node.js 20+) |
| **Lenguaje** | TypeScript 5.x |
| **Bot** | Telegram Bot API (basado en webhook) |
| **Datos Financieros** | Finnhub API (free tier, 60 llamadas/min) |
| **Datos de Precio** | Yahoo Finance (yahoo-finance2, sin API key) |
| **Motor de IA** | OpenRouter API — `meta-llama/llama-4-maverick:free` |
| **Persistencia** | Vercel KV (Redis serverless vía @vercel/kv) |
| **Programación** | Vercel Cron Jobs (3 diarios, Lun-Vie) |
| **Deploy** | Vercel (git push a main) |

### Estructura del Proyecto

```
api/
  webhook.ts           ← Webhook de Telegram: comandos, búsqueda inline, callbacks
  set-webhook.ts       ← Endpoint de registro del webhook (una sola vez)
  cron-morning.ts      ← 6 AM CST: recordatorios de 3 días y 1 día
  cron-afternoon.ts    ← 2 PM CST: alerta ~2h antes de AMC
  cron-evening.ts      ← 4:30 PM CST: análisis con IA + hype ranking semanal
lib/
  finnhub.ts           ← Cliente de Finnhub API (earnings, quotes, recomendaciones)
  yahoo.ts             ← Datos de precio de Yahoo Finance (histórico + tiempo real)
  openrouter.ts        ← Generación de reportes con IA y parsing por delimitadores
  telegram.ts          ← Envío de mensajes con soporte de logos/fotos + botones inline
  kv.ts                ← Operaciones de Vercel KV (watchlists, usuarios, reminders)
  sp500.ts             ← 500 empresas del S&P 500 (ticker, nombre, sector)
  etfs.ts              ← 36 ETFs en 6 categorías
  custom-tickers.ts    ← Tickers fuera del S&P 500 (TSM, ASML, SAP, NVO, SHOP)
  price.ts             ← Formato de bloques de precio (variaciones, rango 52 sem)
  quota.ts             ← Gestión de cuota diaria de OpenRouter (límite 25/día)
  hype.ts              ← Constructor de Hype Ranking (sorpresa + analistas + momentum)
  logo.ts              ← Resolución de logos (Finnhub para acciones, CDN para ETFs)
```

---

## Licencia

Todo el código fuente en este repositorio es **Copyright (c) Donovan Riaño. Todos los derechos reservados.**

El uso, modificación o distribución de este código requiere **autorización previa por escrito** del propietario. El uso no autorizado está prohibido.

---

## Requisitos

### Cuentas y API Keys

| Servicio | Qué Necesitas | Costo |
|---|---|---|
| **Telegram** | Token del bot vía @BotFather | Gratis |
| **Finnhub** | API key de finnhub.io | Gratis (60 llamadas/min) |
| **OpenRouter** | API key de openrouter.ai | Gratis (llama-4-maverick:free) |
| **Vercel** | Cuenta para deploy + KV store | Gratis disponible |
| **Yahoo Finance** | No requiere cuenta | Gratis (librería yahoo-finance2) |

### Variables de Entorno

```env
FINNHUB_API_KEY=tu_clave_finnhub
TELEGRAM_BOT_TOKEN=tu_token_telegram
TELEGRAM_CHAT_ID=tu_chat_id_para_testing
OPENROUTER_API_KEY=tu_clave_openrouter
KV_REST_API_URL=https://xxxx.upstash.io
KV_REST_API_TOKEN=tu_token_kv
```

---

## Configuración

### 1. Crear el Bot de Telegram

1. Abre Telegram, busca **@BotFather**
2. Envía `/newbot`, sigue las instrucciones
   - **Nombre:** `Quartly`
   - **Username:** `QuartlyBot`
3. Guarda el **TOKEN** que te devuelve
4. Habilita modo inline: envía `/setinline` a BotFather, selecciona tu bot
5. Configura comandos: envía `/setcommands`, selecciona tu bot, pega:
   ```
   start - Bienvenida y cómo usar Quartly
   mystocks - Ver y eliminar acciones de tu watchlist
   myetfs - Ver y eliminar ETFs de tu watchlist
   report - Reporte manual de tus favoritos ahora
   ```

### 2. Obtener tu Chat ID

1. Envía cualquier mensaje a tu bot
2. Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
3. Copia el valor de `message.chat.id`

### 3. Obtener API Key de Finnhub

1. Ve a [finnhub.io](https://finnhub.io) → Regístrate (gratis)
2. Dashboard → API Keys → copia tu clave

### 4. Obtener API Key de OpenRouter

1. Ve a [openrouter.ai](https://openrouter.ai) → Regístrate
2. Keys → copia tu API key
3. El modelo `meta-llama/llama-4-maverick:free` no requiere saldo

### 5. Configurar Vercel KV

1. Vercel Dashboard → Storage → Create → KV
2. Nombre: `quartly-kv` → conecta a tu proyecto
3. Copia `KV_REST_API_URL` y `KV_REST_API_TOKEN`

### 6. Configurar Variables de Entorno

En Vercel → Settings → Environment Variables, agrega las 6 variables del archivo `.env`.

### 7. Deploy

```bash
git add .
git commit -m "Initial commit: Quartly bot"
git push origin main
```

Vercel construirá y desplegará automáticamente.

### 8. Activar el Webhook

Visita esta URL **una sola vez** después del deploy:

```
https://tu-proyecto.vercel.app/api/set-webhook
```

Respuesta esperada: `{"ok":true}`

---

## Uso

### Agregar Activos a tu Watchlist

Usa la **búsqueda inline** en cualquier chat de Telegram:

```
@QuartlyBot AAPL
@QuartlyBot Apple
@QuartlyBot QQQ
@QuartlyBot TSM
@QuartlyBot ASML
```

Los resultados muestran `[TICKER] Nombre de Empresa — Sector`. Toca un resultado para agregarlo a tu watchlist. Recibirás un mensaje de confirmación con:

- Precio actual (de Yahoo Finance)
- Variaciones: 1 día, 1 semana, 1 mes, 3 meses, 1 año
- Rango de 52 semanas
- Historial EPS (últimos 4 trimestres, solo acciones)
- Señal de analistas con porcentajes
- Próxima fecha de reporte
- Logo de la empresa (cuando disponible)
- Botón **[🗑️ Eliminar de favoritos]** para eliminación rápida

### Comandos

| Comando | Descripción |
|---|---|
| `/start` | Mensaje de bienvenida con explicación del bot |
| `/mystocks` | Lista tus acciones rastreadas con botones de eliminar |
| `/myetfs` | Lista tus ETFs rastreados con botones de eliminar |
| `/report` | Genera un análisis inmediato de tus favoritos (IA si hay cuota, sino datos crudos) |

### Cron Jobs Automatizados

| Hora (CST) | Trigger | Qué Hace |
|---|---|---|
| **6:00 AM** (Lun-Vie) | `cron-morning` | Envía recordatorios de earnings en 3 días (simple) y 1 día (detallado con precio) |
| **2:00 PM** (Lun-Vie) | `cron-afternoon` | Alerta ~2h antes de earnings AMC (después del cierre) con precio + estimados |
| **4:30 PM** (Lun-Vie) | `cron-evening` | Genera análisis con IA de tus favoritos que reportaron hoy + hype ranking semanal |

### Límites

- **Watchlist:** máximo 30 activos (acciones + ETFs combinados)
- **Análisis IA:** 25 por día (se reinicia automáticamente a medianoche)
- **Finnhub:** 60 llamadas API por minuto (free tier)
- Cuando la cuota se agota, se siguen enviando datos crudos de Finnhub (precio, EPS estimado, señal de analistas)

---

## Cómo Funciona

### Flujo de Búsqueda Inline

1. El usuario escribe `@QuartlyBot <búsqueda>` en cualquier chat de Telegram
2. El bot busca en SP500, custom tickers y ETFs (por ticker y nombre)
3. Devuelve los 10 mejores resultados como `InlineQueryResultArticle`
4. Cuando el usuario selecciona un resultado, se envía al bot un texto marcador (`QUARTLY_ADD_STOCK:TICKER`, `QUARTLY_ADD_ETF:TICKER` o `QUARTLY_ADD_CUSTOM:TICKER`)
5. El bot valida el límite de watchlist (30), agrega a KV, obtiene datos financieros de Yahoo Finance + Finnhub, y envía un mensaje formateado con logo y botón inline de eliminar

### Flujo de Recordatorios de Earnings

1. El cron job obtiene el calendario de earnings de Finnhub para hoy + 7 días
2. Para cada usuario, filtra su watchlist contra el calendario
3. Verifica claves anti-duplicado en KV (`reminded:{chatId}:{ticker}:{date}:{type}`)
4. Envía recordatorios formateados en los intervalos apropiados (3d, 1d, 2h)

### Flujo de Análisis con IA (Cron Evening)

1. Obtiene el calendario de earnings de hoy, filtra empresas con `actual !== null` (ya reportaron)
2. Cruza con las watchlists de todos los usuarios para encontrar qué favoritos reportaron
3. Construye objetos `CompanyData` con historial EPS, señales de analistas, precio
4. Construye `HypeRanking` de earnings de los próximos 7 días (score = avg surprise × 0.5 + buy ratio × 30 + price change 1m × 0.2)
5. Verifica cuota diaria de OpenRouter (25/día)
6. Si hay cuota: envía batch a Llama 4 con system prompt estructurado, parsea respuesta usando delimitadores `---SECTION:TICKER---`
7. Distribuye análisis individuales a cada usuario que rastrea esa acción (con logo)
8. Envía mensaje de hype ranking a todos los usuarios

### Flujo de Datos de Precio

1. **Yahoo Finance** (primario) — `yahoo-finance2` obtiene cotización en tiempo real + 1 año de velas diarias históricas
2. Calcula variaciones porcentuales para 1s (5 días hábiles), 1m (21 días), 3m (63 días), 1a (252 días)
3. **Finnhub** (fallback) — usado para máximo/mínimo de 52 semanas y cambio diario si Yahoo falla
4. Ambas fuentes se consultan en paralelo; los datos de Yahoo tienen prioridad
