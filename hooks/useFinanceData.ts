import { useEffect, useState, useCallback } from "react";
import { formatCurrency } from "@/lib/formatFinance";

export interface KPIData {
  label: string;
  value: string;
  change: number | null;
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
  monthlyChange: number | null;
  kpis: KPIData[];
  recentTransactions: TransactionData[];
  portfolioAllocation: PortfolioAllocation[];
  updatedAt: string;
}

const CHART_COLORS = [
  "var(--chart-positive)",
  "var(--chart-negative)",
  "var(--chart-neutral)",
  "var(--brand-background-strong)",
  "var(--accent-background-strong)",
];

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
      const recentTransactions = [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10);

      const portfolioValue = positions.reduce(
        (sum: number, p: { buyPrice: number; quantity: number }) => sum + p.buyPrice * p.quantity,
        0
      );

      const portfolioAllocation: PortfolioAllocation[] = positions.map(
        (p: { ticker: string; buyPrice: number; quantity: number }, i: number) => ({
          ticker: p.ticker,
          value: p.buyPrice * p.quantity,
          fill: CHART_COLORS[i % CHART_COLORS.length],
        })
      );

      const kpis: KPIData[] = [
        {
          label: "Portafolio",
          value: formatCurrency(portfolioValue),
          change: null,
          icon: "chartPie",
        },
        {
          label: "Transacciones",
          value: String(transactions.length),
          change: null,
          icon: "arrowUp",
        },
        {
          label: "Activos",
          value: String(positions.length),
          change: null,
          icon: "banknotes",
        },
        {
          label: "Cuota IA",
          value: stats.ok ? `${stats.stats.quotaRemaining}/${stats.stats.quotaTotal}` : "N/A",
          change: null,
          icon: "sparkles",
        },
      ];

      setData({
        balance: portfolioValue,
        monthlyChange: null,
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
