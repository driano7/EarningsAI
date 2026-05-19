const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId: string, text: string, parseMode = "Markdown"): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendPhoto(chatId: string, photo: string, caption: string, parseMode = "Markdown"): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo,
        caption,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const CAPTION_LIMIT = 1024;

export async function sendMessageWithLogo(chatId: string, text: string, logoUrl: string | null, parseMode = "Markdown"): Promise<boolean> {
  if (logoUrl) {
    if (text.length > CAPTION_LIMIT) {
      const truncated = text.substring(0, CAPTION_LIMIT - 30) + "\n[ver análisis completo abajo]";
      await sendPhoto(chatId, logoUrl, truncated, parseMode);
      return sendMessage(chatId, text, parseMode);
    }
    return sendPhoto(chatId, logoUrl, text, parseMode);
  }
  return sendMessage(chatId, text, parseMode);
}

export function answerInlineQuery(inlineQueryId: string, results: unknown[]): Promise<boolean> {
  return fetch(`${BASE}/answerInlineQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inline_query_id: inlineQueryId, results }),
  })
    .then((r) => r.ok)
    .catch(() => false);
}
