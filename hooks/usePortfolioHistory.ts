/*
 * Quartly Bot — hooks/usePortfolioHistory.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { PortfolioMovement, MonthlySnapshot } from "@/lib/portfolio-history";

interface PortfolioSummary {
  totalInvested: number;
  totalWithdrawn: number;
  totalDividends: number;
  netFlow: number;
  buyCount: number;
  sellCount: number;
  totalMovements: number;
  byType: Record<string, number>;
  byTicker: Record<string, number>;
}

interface UsePortfolioHistoryResult {
  movements: PortfolioMovement[];
  snapshots: MonthlySnapshot[];
  summary: PortfolioSummary | null;
  loading: boolean;
  period: string;
  setPeriod: (p: string) => void;
  refresh: () => void;
  addMovement: (data: Omit<PortfolioMovement, "id" | "chatId" | "createdAt">) => Promise<boolean>;
  deleteMovement: (id: string) => Promise<boolean>;
}

export function usePortfolioHistory(): UsePortfolioHistoryResult {
  const [movements, setMovements] = useState<PortfolioMovement[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const [resolvedChatId, setResolvedChatId] = useState<string | null>(null);

  const chatId = typeof window !== "undefined"
    ? resolvedChatId || localStorage.getItem("quartly_chatId") || "default"
    : "default";

  useEffect(() => {
    if (typeof window !== "undefined" && !resolvedChatId && !localStorage.getItem("quartly_chatId")) {
      fetch("/api/auth/users").then(r=>r.json()).then(d=>{
        if(d.ok && d.users?.length===1){ localStorage.setItem("quartly_chatId", d.users[0]); setResolvedChatId(d.users[0]); }
        else if(d.ok && d.users?.length>1){ setLoading(false); }
      }).catch(()=>{});
    }
  }, [resolvedChatId]);

  useEffect(() => {
    if (!chatId || chatId === "default") { /* espera a resolver */ if(resolvedChatId===null) return; setLoading(false); return; }
    setLoading(true);
    fetch(`/api/dashboard/portfolio/history?chatId=${chatId}&period=${period}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setMovements(data.movements || []);
          setSnapshots(data.snapshots || []);
          setSummary(data.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatId, period, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const addMovement = useCallback(async (data: Omit<PortfolioMovement, "id" | "chatId" | "createdAt">): Promise<boolean> => {
    try {
      const res = await fetch("/api/dashboard/portfolio/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, ...data }),
      });
      const result = await res.json();
      if (result.ok) refresh();
      return result.ok;
    } catch {
      return false;
    }
  }, [chatId, refresh]);

  const deleteMovement = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/dashboard/portfolio/history?chatId=${chatId}&id=${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.ok) refresh();
      return result.ok;
    } catch {
      return false;
    }
  }, [chatId, refresh]);

  return { movements, snapshots, summary, loading, period, setPeriod, refresh, addMovement, deleteMovement };
}
