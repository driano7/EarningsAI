/*
 * Quartly Bot — components/dashboard/MacroChart.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Column, Row, Text, IconButton, Skeleton } from "@once-ui-system/core";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { getRandomBarColor, CHART_GLASS_STYLE } from "@/lib/chartColors";

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
          setError(d.error || "No hay datos historicos");
        }
      })
      .catch(() => setError("Error cargando datos"))
      .finally(() => setLoading(false));
  }, [seriesId]);

  const latest = data.length > 0 ? data[data.length - 1].value : null;
  const prev = data.length > 1 ? data[data.length - 2].value : null;
  const change = latest !== null && prev !== null && prev !== 0
    ? ((latest - prev) / Math.abs(prev)) * 100
    : null;

  const barColors = useMemo(
    () => data.map((_, i) => getRandomBarColor(i)),
    [data.length],
  );

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
          maxWidth: 700,
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
            <div style={{ width: "100%", height: 350, ...CHART_GLASS_STYLE, padding: "0.5rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
                    formatter={(value) => [`${Number(value).toFixed(3)} ${unit}`, label]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {data.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={barColors[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Column>
      </Column>
    </div>
  );
}
