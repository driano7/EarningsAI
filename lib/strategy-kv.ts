import { kv } from "@vercel/kv";
import type { SavedStrategy, StrategyJSON } from "./strategy-types";

// KV key pattern: strategies:{chatId} → SavedStrategy[]
// Max 20 strategies per user

const MAX_STRATEGIES = 20;

export async function getUserStrategies(chatId: string): Promise<SavedStrategy[]> {
  const list = await kv.get<SavedStrategy[]>(`strategies:${chatId}`);
  return list || [];
}

export async function saveStrategy(
  chatId: string,
  strategy: Omit<SavedStrategy, "id" | "createdAt" | "updatedAt">
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const existing = await getUserStrategies(chatId);

  if (existing.length >= MAX_STRATEGIES) {
    return {
      ok: false,
      error: `Límite de ${MAX_STRATEGIES} estrategias alcanzado. Elimina una antes de guardar otra.`,
    };
  }

  // Check duplicate name
  if (existing.some((s) => s.name.toLowerCase() === strategy.name.toLowerCase())) {
    return { ok: false, error: `Ya tienes una estrategia llamada "${strategy.name}".` };
  }

  const id = `str_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const newStrategy: SavedStrategy = {
    ...strategy,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(`strategies:${chatId}`, [...existing, newStrategy]);
  return { ok: true, id };
}

export async function updateStrategy(
  chatId: string,
  id: string,
  patch: { name?: string; prompt?: string; json?: StrategyJSON; ticker?: string }
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getUserStrategies(chatId);
  const idx = existing.findIndex((s) => s.id === id);

  if (idx === -1) return { ok: false, error: "Estrategia no encontrada." };

  existing[idx] = {
    ...existing[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`strategies:${chatId}`, existing);
  return { ok: true };
}

export async function deleteStrategy(
  chatId: string,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getUserStrategies(chatId);
  const filtered = existing.filter((s) => s.id !== id);

  if (filtered.length === existing.length) {
    return { ok: false, error: "Estrategia no encontrada." };
  }

  await kv.set(`strategies:${chatId}`, filtered);
  return { ok: true };
}

export async function getStrategyById(
  chatId: string,
  id: string
): Promise<SavedStrategy | null> {
  const list = await getUserStrategies(chatId);
  return list.find((s) => s.id === id) || null;
}