/*
 * Quartly Bot — api/set-webhook.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN not set" });
  }

  const domain = process.env.VERCEL_URL || "quartly.vercel.app";
  const webhookUrl = `https://${domain}/api/webhook`;

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const webhookData = await setRes.json();

  const commandsRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Bienvenida y cómo usar Quartly" },
        { command: "mystocks", description: "Ver y eliminar acciones" },
        { command: "myetfs", description: "Ver y eliminar ETFs" },
        { command: "mycryptos", description: "Ver y eliminar cryptos" },
        { command: "link", description: "Vincular con Dashboard web" },
        { command: "report", description: "Reporte manual de favoritos" },
        { command: "news", description: "Resumen diario de noticias" },
        { command: "income", description: "Registrar ingreso" },
        { command: "expense", description: "Registrar gasto" },
        { command: "invest", description: "Registrar inversión" },
        { command: "summary", description: "Resumen mensual" },
        { command: "categories", description: "Ver y editar categorías" },
        { command: "export_csv", description: "Exportar datos a CSV" },
      ],
    }),
  });

  const commandsData = await commandsRes.json();

  return res.status(200).json({ webhook: webhookData, commands: commandsData });
}
