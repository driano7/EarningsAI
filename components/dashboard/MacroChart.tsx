"use client";

import { useState, useEffect } from "react";
import { Column, Row, Text, IconButton, Skeleton } from "@once-ui-system/core";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface MacroHistorical {
  date: string;
  value: number;
}

interface Props {
  seriesId: string;
  label: string;
  unit: string;
  onClose: () => void;
}

export function MacroChart({ seriesId, label, unit, onClose }: Props) {
  const [data, setData] = useState<MacroHistorical[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/dashboard/macro/history?seriesId=${seriesId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.data) {
          setData(d.data);
        } else {
          setError(d.error || "No hay datos históricos");
        }
      })
      .catch(() => setError("Error cargando datos"))
      .finally(() => setLoading(false));
  }, [seriesId]);

  const latest = data.length > 0 ? data[data.length - 1].value : null;
  const prev = data.length > 1 ? data[data.length - 2].value : null;
  const change = latest !== null && prev !== null ? latest - prev : null;

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
          <Text variant="heading-strong-m">{label}</Text>
          {latest !== null && (
            <Text variant="label-strong-s">
              {latest.toFixed(2)} {unit}
            </Text>
          )}
          {change !== null && (
            <Text
              variant="label-default-xs"
              onBackground={change >= 0 ? "success-medium" : "danger-medium"}
            >
              {change >= 0 ? "+" : ""}{change.toFixed(3)}
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
        <div style={{ width: "100%", height: 250 }}>
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
                formatter={(value) => [`${Number(value).toFixed(3)} ${unit}`, label]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--brand-strong)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Column>
  );
}
