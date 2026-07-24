"use client";

import { useState, useEffect } from "react";
import { Column, Row, Text, IconButton, Skeleton } from "@once-ui-system/core";
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
            setError(d.error || "No hay datos históricos");
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
            setError(d.error || "No hay datos históricos");
          }
        })
        .catch(() => setError("Error cargando datos"))
        .finally(() => setLoading(false));
    }
  }, [ticker, type]);

  const change = data.length >= 2
    ? ((data[data.length - 1].value - data[data.length - 2].value) / data[data.length - 2].value) * 100
    : null;

  return (
    <Column
      padding="m"
      radius="m"
      fillWidth
      gap="m"
      style={{
        border: "1px solid var(--neutral-alpha-medium)",
        background: "var(--neutral-alpha-weak)",
      }}
    >
      <Row vertical="center" horizontal="between">
        <Row gap="s" vertical="center">
          <Text variant="heading-strong-m">{ticker}</Text>
          {currentPrice !== null && (
            <Text variant="label-strong-s">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          )}
          {change !== null && (
            <Text
              variant="label-default-xs"
              onBackground={change >= 0 ? "success-medium" : "danger-medium"}
            >
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </Text>
          )}
        </Row>
        <IconButton icon="close" size="s" variant="tertiary" onClick={onClose} />
      </Row>

      {loading ? (
        <Skeleton shape="block" height="xl" fillWidth radius="m" />
      ) : error ? (
        <Column fillWidth horizontal="center" padding="l">
          <Text variant="body-default-s" onBackground="neutral-weak">{error}</Text>
        </Column>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
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
                  background: "var(--neutral-alpha-weak)",
                  border: "1px solid var(--neutral-alpha-medium)",
                  borderRadius: 8,
                  backdropFilter: "blur(12px)",
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

      <Row gap="s" wrap>
        {type === "stock" && (
          <Text variant="label-default-xs" onBackground="neutral-weak">
            📈 Datos de los últimos 12 meses vía Finnhub
          </Text>
        )}
        {type === "etf" && (
          <Text variant="label-default-xs" onBackground="neutral-weak">
            📊 Datos de los últimos 12 meses vía Finnhub
          </Text>
        )}
        {type === "crypto" && (
          <Text variant="label-default-xs" onBackground="neutral-weak">
            🪙 Datos de los últimos 30 días vía CoinGecko
          </Text>
        )}
      </Row>
    </Column>
  );
}
