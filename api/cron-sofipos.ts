/*
 * Quartly Bot — api/cron-sofipos.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Cron semanal (domingo 08:00 UTC).
 * Analiza las posiciones tipo SOFIPO y CETES de cada usuario, busca noticias
 * recientes de la institución y usa OpenRouter para detectar el rendimiento
 * anual vigente (%), fecha de vencimiento y condiciones. Actualiza
 * automáticamente la tabla de portfolio (rendimiento / vence / condiciones).
 * Cripto y acciones quedan excluidas para no gastar tokens.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { env } from "../lib/env";
import { getAllUsers } from "../lib/kv";
import { getPositions, updatePosition } from "../lib/kv-portfolio";
import { getTickerNews } from "../lib/news";
import { sendMessage } from "../lib/telegram";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

function isSavingsType(type: string): boolean {
  return type === "sofipo" || type === "cetes";
}

function formatDate(iso?: string): string {
  if (!iso) return "sin fecha";
  return new Date(iso).toISOString().split("T")[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const users = await getAllUsers();
  if (users.length === 0) {
    return res.status(200).json({ ok: true, message: "No hay usuarios registrados" });
  }

  let totalUpdated = 0;
  let totalUsersProcessed = 0;

  for (const chatId of users) {
    const positions = await getPositions(chatId);
    const savings = positions.filter((p) => isSavingsType(p.type));
    if (savings.length === 0) continue;

    await sendMessage(
      chatId,
      `📬 *Actualización semanal de sofipos* — analizando *${savings.length}* posición(es)...`
    );

    // Buscar noticias recientes de cada institución para el prompt.
    const newsItems: string[] = [];
    for (const pos of savings) {
      const articles = await getTickerNews(pos.ticker, pos.ticker, 3);
      const recent = articles.slice(0, 3);
      if (recent.length > 0) {
        newsItems.push(
          `[${pos.ticker}]\n${recent
            .map((a) => `- ${a.title}${a.description ? `: ${a.description.slice(0, 140)}` : ""}`)
            .join("\n")}`
        );
      } else {
        newsItems.push(`[${pos.ticker}]\nSin noticias en los últimos 7 días.`);
      }
      await sleep(300);
    }

    const prompt = `Eres un analista financiero en México especializado en sofipos (sociedades financieras populares) y CETES.

A continuación tienes las posiciones de ahorro de un usuario y las NOTICIAS recientes de cada institución. Tu trabajo es actualizar cada posición con:
1. rendimientoAnual: el rendimiento anual vigente (GAT nominal) expresado como número, ej. 12.5 (sin el %). Si una noticia menciona un cambio de tasa, usa la MÁS RECIENTE.
2. vencimiento: fecha o plazo de la posición (ej. 2026-08-01 o "revisable anualmente"). Responde "no disponible" si no aparece.
3. condiciones: condiciones relevantes de la institución (monto límite de inversión, retiros diarios/mensuales, montos mínimos, seguro de depósito, requisitos). Responde "no mencionadas" si no hay info.

POSICIONES:
${savings
  .map(
    (p) =>
      `- ${p.ticker} (${p.type}) — invertido $${p.buyPrice.toLocaleString("en-US")} el ${formatDate(p.buyDate)} — rendimiento actual: ${p.yieldRate ? `${p.yieldRate}%` : "no capturado"} — vence: ${formatDate(p.expiresAt)} — condiciones: ${p.conditions || "no capturadas"}`
  )
  .join("\n")}

NOTICIAS RECIENTES (7 días):
${newsItems.join("\n---\n")}

FORMATO OBLIGATORIO — responde SOLO con este bloque (uno por ticker), sin markdown:
---POS:SOFIPO_TICKER---
rendimiento: 12.5
vencimiento: 2026-08-01
condiciones: Monto lim. $150,000 MXN, retiros por $5,000 diarion sin penalización.

Usa SOLO los tickers listados arriba. En cripto/acciones no apliques cambios.`;

    const resOr = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://quartly.vercel.app",
        "X-Title": "Quartly Bot",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        temperature: 0.1,
        max_tokens: 1500,
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: `Actualiza rendimiento, vencimiento y condiciones de estas sofipos: ${savings
              .map((p) => p.ticker)
              .join(", ")}.`,
          },
        ],
      }),
    });

    if (!resOr.ok) {
      console.error(`[cron-sofipos] OpenRouter error para ${chatId}:`, resOr.status);
      await sendMessage(chatId, "⚠️ No se pudo actualizar la información de tasas esta semana.");
      continue;
    }

    const data = (await resOr.json()) as { choices?: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    if (!content) {
      await sendMessage(chatId, "⚠️ No se pudo actualizar la información de tasas esta semana.");
      continue;
    }

    const updates: Record<string, { yieldRate?: number; expiresAt?: string; conditions?: string }> = {};
    const parts = content.split("---POS:");
    for (const part of parts) {
      const close = part.indexOf("---");
      if (close === -1) continue;
      let ticker = part.substring(0, close).trim().toUpperCase();
      if (ticker.startsWith("SOFIPO_")) ticker = ticker.substring(7);
      const body = part.substring(close + 3).trim();

      const yieldMatch = body.match(/rendimiento:\s*([0-9]+(?:\.[0-9]+)?)/i);
      const vencMatch = body.match(/vencimiento:\s*(.+)/i);
      const condMatch = body.match(/condiciones:\s*(.+)/i);

      const update: { yieldRate?: number; expiresAt?: string; conditions?: string } = {};
      if (yieldMatch) update.yieldRate = parseFloat(yieldMatch[1]);
      const vencimiento = vencMatch ? vencMatch[1].trim() : "";
      if (vencimiento && !/no disponible/i.test(vencimiento)) {
        const m = vencimiento.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (m) update.expiresAt = `${m[1]}-${m[2]}-${m[3]}`;
        else update.expiresAt = vencimiento;
      }
      const condiciones = condMatch ? condMatch[1].trim() : "";
      if (condiciones && !/no mencionadas/i.test(condiciones)) update.conditions = condiciones;

      if (update.yieldRate !== undefined || update.expiresAt || update.conditions) {
        updates[ticker] = update;
      }
    }

    if (Object.keys(updates).length === 0) {
      await sendMessage(chatId, "ℹ️ No hubo cambios detectados en tus sofipos esta semana.");
      continue;
    }

    const changed: string[] = [];
    for (const pos of savings) {
      const u = updates[pos.ticker];
      if (!u) continue;
      await updatePosition(chatId, pos.id, u);
      totalUpdated++;
      changed.push(pos.ticker);
    }

    await sendMessage(
      chatId,
      `✅ *Sofipos actualizadas* — ${changed.length} posición(es) actualizada(s) con la info más reciente:\n\n${changed
        .map((t) => {
          const u = updates[t];
          const bits = [
            u.yieldRate !== undefined ? `rendimiento: ${u.yieldRate}%` : null,
            u.expiresAt ? `vence: ${u.expiresAt}` : null,
            u.conditions ? `condiciones: ${u.conditions}` : null,
          ].filter(Boolean);
          return `• ${t}: ${bits.join(", ")}`;
        })
        .join("\n")}`
    );

    totalUsersProcessed++;
    await sleep(1000);
  }

  return res.status(200).json({
    ok: true,
    message: `Sofipos actualizadas para ${totalUsersProcessed} usuarios, ${totalUpdated} posiciones`,
  });
}