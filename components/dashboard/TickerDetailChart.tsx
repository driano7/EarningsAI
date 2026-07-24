/*
 * Quartly Bot — components/dashboard/TickerDetailChart.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect } from "react";
import { Column, Row, Text, IconButton, Skeleton, Badge } from "@once-ui-system/core";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface HistoricalData {
  date: string;
  value: number;
}

interface Props {
  ticker: string;
  type: "stock" | "etf" | "crypto";
  onClose: () => void;
}

export function TickerDetailChart({ ticker, type, onClose }: Props) {
  const [data, setData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");

    if (type === "crypto") {
      fetch(`/api/dashboard/favorites/crypto/history?ticker=${ticker}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.data) {
            setData(d.data);
            if (d.data.length > 0) setCurrentPrice(d.data[d.data.length - 1].value);
          } else {
            setError(d.error || "No hay datos historicos");
          }
        })
        .catch(() => setError("Error cargando datos"))
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/dashboard/favorites/quote/history?ticker=${ticker}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.data) {
            setData(d.data);
            if (d.data.length > 0) setCurrentPrice(d.data[d.data.length - 1].value);
          } else {
            setError(d.error || "No hay datos historicos");
          }
        })
        .catch(() => setError("Error cargando datos"))
        .finally(() => setLoading(false));
    }
  }, [ticker, type]);

  const change = data.length >= 2
    ? ((data[data.length - 1].value - data[data.length - 2].value) / data[data.length - 2].value) * 100
    : null;

  const colorMap = { stock: "brand", etf: "accent", crypto: "brand" } as const;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.88)",
        }}
        onClick={onClose}
      />

      <Column
        radius="l"
        fillWidth
        className="liquid-glass"
        style={{
          position: "relative",
          maxWidth: 600,
          maxHeight: "85vh",
          background: "var(--neutral-background)",
          border: "1px solid var(--neutral-alpha-medium)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Row
          fillWidth
          horizontal="between"
          vertical="center"
          padding="l"
          style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}
        >
          <Row gap="s" vertical="center">
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
          <IconButton icon="close" size="s" variant="tertiary" onClick={onClose} />
        </Row>

        <Column padding="l" style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <Skeleton shape="block" height="xl" fillWidth radius="m" />
          ) : error ? (
            <Column fillWidth horizontal="center" padding="xl">
              <Text variant="body-default-s" onBackground="neutral-weak">{error}</Text>
            </Column>
          ) : (
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-weak)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.04)",
                      backdropFilter: "blur(24px) saturate(1.6)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
                      padding: "0.5rem 0.75rem",
                      color: "var(--neutral-on-background-strong)",
                    }}
                    formatter={(value) => [
                      `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      ticker,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={change !== null && change >= 0 ? "var(--success-strong)" : "var(--danger-strong)"}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <Row gap="s" wrap paddingY="s">
            {type === "stock" && (
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Datos de los ultimos 12 meses via Finnhub
              </Text>
            )}
            {type === "etf" && (
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Datos de los ultimos 12 meses via Finnhub
              </Text>
            )}
            {type === "crypto" && (
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Datos de los ultimos 30 dias via CoinGecko
              </Text>
            )}
          </Row>
        </Column>
      </Column>
    </div>
  );
}
