/*
 * Quartly Bot — lib/audit-history.ts
 * Historial de auditoría append-only, sin TTL, visible siempre debajo de analítica.
 */

import { kv } from "@vercel/kv";

export type AuditMethod = "manual" | "chatbot";
export type AuditWhere = "portfolio-analytics" | "portfolio" | "bot" | "telegram" | "api" | string;

export interface AuditEntry {
  id: string;
  chatId: string;
  timestamp: string; // ISO
  dateTime: string; // locale ES-MX
  change: string;
  where: AuditWhere;
  method: AuditMethod;
  os: string;
  browser: string;
  userAgent: string;
  ip?: string;
}

const AUDIT_KEY = (chatId: string) => `audit:history:${chatId}`;
// sin expiración: nunca se borra

function parseUA(ua: string): { os: string; browser: string } {
  const u = ua.toLowerCase();
  let os = "Desconocido";
  if (u.includes("windows")) os = "Windows";
  else if (u.includes("mac os")) os = "macOS";
  else if (u.includes("android")) os = "Android";
  else if (u.includes("iphone") || u.includes("ipad")) os = "iOS";
  else if (u.includes("linux")) os = "Linux";

  let browser = "Desconocido";
  if (u.includes("edg/")) browser = "Edge";
  else if (u.includes("chrome/") && !u.includes("edg")) browser = "Chrome";
  else if (u.includes("safari/") && !u.includes("chrome")) browser = "Safari";
  else if (u.includes("firefox/")) browser = "Firefox";
  else if (u.includes("telegram")) browser = "Telegram";

  return { os, browser };
}

export async function getAuditHistory(chatId: string): Promise<AuditEntry[]> {
  const data = await kv.get<AuditEntry[]>(AUDIT_KEY(chatId));
  return (data || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function addAuditEntry(params: {
  chatId: string;
  change: string;
  where: AuditWhere;
  method: AuditMethod;
  userAgent?: string;
  ip?: string;
}): Promise<AuditEntry> {
  const ua = params.userAgent || "unknown";
  const { os, browser } = parseUA(ua);
  const now = new Date();
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    chatId: params.chatId,
    timestamp: now.toISOString(),
    dateTime: now.toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "medium" }),
    change: params.change,
    where: params.where,
    method: params.method,
    os,
    browser,
    userAgent: ua,
    ip: params.ip,
  };
  const existing = await getAuditHistory(params.chatId);
  existing.unshift(entry);
  // guarda sin expiración, cap 2000 entradas para no saturar KV pero nunca borra por tiempo
  const capped = existing.slice(0, 2000);
  await kv.set(AUDIT_KEY(params.chatId), capped);
  return entry;
}
