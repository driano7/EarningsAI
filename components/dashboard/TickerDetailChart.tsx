/*
 * Quartly Bot — components/dashboard/TickerDetailChart.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Column, Row, Text, IconButton, Skeleton, Badge } from "@once-ui-system/core";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { CHART_GLASS_STYLE } from "@/lib/chartColors";
import { AnimatedDot } from "@/components/charts/AnimatedDot";

interface HistoricalData {
  date: string;
  value: number;
}

const PERIODS = [
  { label: "1D", value: "1d" },
  { label: "1S", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1A", value: "1y" },
  { label: "3A", value: "3y" },
];

const CHART_TYPES = [
  { label: "Linea", value: "line" },
  { label: "Area", value: "area" },
  { label: "Barras", value: "bar" },
];

interface Props {
  ticker: string;
  type: "stock" | "etf" | "crypto";
  anchorRect?: DOMRect | null;
  onClose: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function TickerDetailChart({ ticker, type, anchorRect, onClose }: Props) {
  const [data, setData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [period, setPeriod] = useState<string>("1y");
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("line");
  const [dataTimestamp, setDataTimestamp] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setLoading(true);
    setError("");

    const endpoint = type === "crypto"
      ? `/api/dashboard/favorites/crypto/history?ticker=${ticker}&period=${period}`
      : `/api/dashboard/favorites/quote/history?ticker=${ticker}&period=${period}`;

    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.data) {
          setData(d.data);
          if (d.data.length > 0) setCurrentPrice(d.data[d.data.length - 1].value);
          setDataTimestamp(Date.now());
        } else {
          setError(d.error || "No hay datos historicos");
        }
      })
      .catch(() => setError("Error cargando datos"))
      .finally(() => setLoading(false));
  }, [ticker, type, period]);

  const change = data.length >= 2
    ? ((data[data.length - 1].value - data[data.length - 2].value) / data[data.length - 2].value) * 100
    : null;

  const colorMap = { stock: "brand", etf: "accent", crypto: "brand" } as const;
  const lineColor = change === null
    ? "#94a3b8"
    : change >= 0
      ? "#22c55e"
      : "#ef4444";
  const gridColor = "rgba(255,255,255,0.05)";

  // Calculate popover position (client-side only)
  const popoverStyle: React.CSSProperties = anchorRect && mounted
    ? {
        position: "fixed",
        left: Math.min(anchorRect.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 720),
        top: anchorRect.bottom + 8,
        zIndex: 2000,
        maxWidth: 700,
        width: "100%",
      }
    : { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div
      style={popoverStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Column
        radius="l"
        className="liquid-glass"
        style={{
          position: "relative",
          maxWidth: 700,
          maxHeight: "85vh",
          background: "var(--neutral-background)",
          border: "1px solid var(--neutral-alpha-medium)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Row
          fillWidth
          horizontal="between"
          vertical="center"
          padding="l"
          style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}
        >
          <Row gap="s" vertical="center" wrap>
            <Badge textVariant="label-default-s" color={colorMap[type]}>
              {type === "stock" ? "Accion" : type === "etf" ? "ETF" : "Crypto"}
            </Badge>
            <Text variant="heading-strong-m">{ticker}</Text>
            {currentPrice !== null && (
              <Text variant="heading-strong-s">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
            {change !== null && (
              <Text
                variant="label-default-s"
                onBackground={change >= 0 ? "success-medium" : "danger-medium"}
              >
                {change >= 0 ? "+" : ""}{change.toFixed(2)}%
              </Text>
            )}
          </Row>
          <Row gap="xs" vertical="center">
            <select
              id="period-select"
              className="liquid-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: 100, height: 36, fontSize: 13 }}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              id="chart-type-select"
              className="liquid-select"
              value={chartType}
              onChange={(e) => setChartType(e.target.value as "line" | "area" | "bar")}
              style={{ width: 90, height: 36, fontSize: 13 }}
            >
              {CHART_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <IconButton icon="close" size="s" variant="tertiary" onClick={onClose} />
          </Row>
        </Row>

        <Column padding="l" style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <Skeleton shape="block" height="xl" fillWidth radius="m" />
          ) : error ? (
            <Column fillWidth horizontal="center" padding="xl">
              <Text variant="body-default-s" onBackground="neutral-weak">{error}</Text>
            </Column>
          ) : (
            <div style={CHART_GLASS_STYLE}>
              <ResponsiveContainer width="100%" height={400}>
                {chartType === "bar" ? (
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--neutral-surface)",
                        border: "1px solid var(--neutral-alpha-medium)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        padding: "0.5rem 0.75rem",
                        color: "var(--neutral-on-background-strong)",
                      }}
                      formatter={(value) => [`${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, ticker]}
                    />
                    <Bar dataKey="value" fill={lineColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                ) : chartType === "area" ? (
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--neutral-surface)",
                        border: "1px solid var(--neutral-alpha-medium)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        padding: "0.5rem 0.75rem",
                        color: "var(--neutral-on-background-strong)",
                      }}
                      formatter={(value) => [`${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, ticker]}
                    />
                    <Area type="monotone" dataKey="value" stroke={lineColor} fill={lineColor} fillOpacity={0.35} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={lineColor}
                      strokeWidth={2}
                      dot={(dotProps) => <AnimatedDot {...(dotProps as object)} fill={lineColor} />}
                      activeDot={(dotProps) => <AnimatedDot {...(dotProps as object)} fill={lineColor} />}
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--neutral-surface)",
                        border: "1px solid var(--neutral-alpha-medium)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        padding: "0.5rem 0.75rem",
                        color: "var(--neutral-on-background-strong)",
                      }}
                      formatter={(value) => [`${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, ticker]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={lineColor}
                      strokeWidth={2}
                      dot={(dotProps) => <AnimatedDot {...(dotProps as object)} fill={lineColor} />}
                      activeDot={(dotProps) => <AnimatedDot {...(dotProps as object)} fill={lineColor} />}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <Row gap="s" wrap paddingY="s">
            {type === "stock" && (
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Datos via Finnhub / Twelve Data
              </Text>
            )}
            {type === "etf" && (
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Datos via Finnhub / Twelve Data
              </Text>
            )}
            {type === "crypto" && (
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Datos via CoinMarketCap / CoinGecko
              </Text>
            )}
          </Row>
        </Column>
      </Column>
    </div>
  );
}