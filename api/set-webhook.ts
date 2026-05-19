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

  const data = await setRes.json();
  return res.status(200).json(data);
}
