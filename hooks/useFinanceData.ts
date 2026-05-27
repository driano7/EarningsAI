/*
 * Quartly Bot — hooks/useFinanceData.ts
 */

import { useEffect, useState, useMemo, useCallback } from "react";

export interface KPIData {
  label: string;
  value: string;
  change: number;
  icon: string;
}

export interface TransactionData {
  id: string;
  type: "buy" | "sell";
  ticker: string;
  price: number;
  quantity: number;
  date: string;
  notes?: string;
}

export interface PortfolioAllocation {
  ticker: string;
  value: number;
  fill: string;
}

export interface FinanceData {
  balance: number;
  monthlyChange: number;
  kpis: KPIData[];
  recentTransactions: TransactionData[];
  portfolioAllocation: PortfolioAllocation[];
  updatedAt: string;
}

export function useFinanceData(): {
  data: FinanceData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chatId = typeof window !== "undefined" ? localStorage.getItem("quartly_chatId") || "default" : "default";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsRes, txnsRes, portfolioRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch(`/api/dashboard/transactions?chatId=${chatId}`),
        fetch(`/api/dashboard/portfolio?chatId=${chatId}`),
      ]);

      const stats = await statsRes.json();
      const txns = await txnsRes.json();
      const portfolio = await portfolioRes.json();

      const positions = portfolio.ok ? (portfolio.positions || []) : [];
      const transactions: TransactionData[] = txns.ok ? (txns.transactions || []) : [];
      const recentTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

      const portfolioValue = positions.reduce(
        (sum: number, p: { buyPrice: number; quantity: number }) => sum + p.buyPrice * p.quantity,
        0
      );

      const portfolioAllocation: PortfolioAllocation[] = positions.map(
        (p: { ticker: string; buyPrice: number; quantity: number }, i: number) => ({
          ticker: p.ticker,
          value: p.buyPrice * p.quantity,
          fill: `var(--chart-${i % 5})`,
        })
      );

      const kpis: KPIData[] = [
        {
          label: "Portafolio",
          value: `$${portfolioValue.toLocaleString()}`,
          change: 2.4,
          icon: "chartPie",
        },
        {
          label: "Transacciones",
          value: String(transactions.length),
          change: 12,
          icon: "arrowUp",
        },
        {
          label: "Activos",
          value: String(positions.length),
          change: 0,
          icon: "banknotes",
        },
        {
          label: "Cuota IA",
          value: stats.ok ? `${stats.stats.quotaRemaining}/${stats.stats.quotaTotal}` : "N/A",
          change: -5,
          icon: "sparkles",
        },
      ];

      setData({
        balance: portfolioValue,
        monthlyChange: 2.4,
        kpis,
        recentTransactions,
        portfolioAllocation,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("useFinanceData error:", err);
      setError("Error al cargar datos financieros");
    }

    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
