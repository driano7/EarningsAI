/*
 * Quartly Bot — app/dashboard/portfolio-analytics/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useRef, useMemo } from "react";
import { Column, Row, Heading, Text, Badge, Card, Grid, Button, IconButton } from "@once-ui-system/core";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import { formatCurrency, formatPercent } from "@/lib/formatFinance";
import { getRandomBarColor, CHART_GLASS_STYLE } from "@/lib/chartColors";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { exportCsvDownload, exportXlsxDownload } from "@/lib/chart-utils";

const PERIODS = [
  { label: "1D", value: "1d" },
  { label: "1M", value: "1m" },
  { label: "6M", value: "6m" },
  { label: "1A", value: "1y" },
  { label: "3A", value: "3y" },
];

const CHART_TYPES = [
  { label: "Linea", value: "line" },
  { label: "Area", value: "area" },
] as const;

const MOVEMENT_TYPES = [
  { label: "Compra", value: "buy", color: "success" },
  { label: "Venta", value: "sell", color: "danger" },
  { label: "Deposito", value: "deposit", color: "brand" },
  { label: "Retiro", value: "withdrawal", color: "warning" },
  { label: "Dividendo", value: "dividend", color: "accent" },
  { label: "Transferencia", value: "transfer", color: "neutral" },
] as const;

const PIE_COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280"];

export default function PortfolioAnalyticsPage() {
  const {
    movements, snapshots, summary, loading,
    period, setPeriod, refresh, addMovement, deleteMovement,
  } = usePortfolioHistory();

  const [showForm, setShowForm] = useState(false);
  const [chartType, setChartType] = useState<"line" | "area">("line");
  const [form, setForm] = useState({
    type: "buy" as string,
    ticker: "",
    amount: "",
    quantity: "1",
    price: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const chartRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    if (!form.ticker || !form.amount || !form.date) return;
    await addMovement({
      type: form.type as any,
      ticker: form.ticker,
      amount: Number(form.amount),
      quantity: Number(form.quantity || 1),
      price: Number(form.price || form.amount),
      date: form.date,
      notes: form.notes,
    });
    setForm({ type: "buy", ticker: "", amount: "", quantity: "1", price: "", date: new Date().toISOString().split("T")[0], notes: "" });
    setShowForm(false);
  };

  const lineData = useMemo(() => {
    let cumulative = 0;
    return snapshots.map((s) => {
      cumulative += s.netInvested;
      return { month: s.month, value: cumulative, invested: s.netInvested, movements: s.movements };
    });
  }, [snapshots]);

  const barData = useMemo(() =>
    snapshots.map((s) => ({
      month: s.month,
      Inversion: s.stocksValue,
      Sofipos: s.sofiposValue,
      Crypto: s.cryptoValue,
    })),
  [snapshots]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byTicker)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([ticker, value]) => ({ name: ticker, value: Math.abs(value) }));
  }, [summary]);

  const typePieData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byType)
      .map(([type, value]) => {
        const label = MOVEMENT_TYPES.find((t) => t.value === type)?.label || type;
        return { name: label, value: Math.abs(value) };
      })
      .filter((d) => d.value > 0);
  }, [summary]);

  const csvHeaders = ["Fecha", "Tipo", "Ticker", "Monto", "Cantidad", "Precio", "Notas"];
  const csvRows = movements.map((m) => [
    m.date,
    MOVEMENT_TYPES.find((t) => t.value === m.type)?.label || m.type,
    m.ticker,
    m.amount.toFixed(2),
    m.quantity.toString(),
    m.price.toFixed(2),
    m.notes,
  ]);

  const handleExportPng = async () => {
    if (!chartRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: "#0a0a0a" });
      const link = document.createElement("a");
      link.download = `portafolio-${period}.png`;
      link.href = dataUrl;
      link.click();
    } catch {}
  };

  return (
    <Column gap="l">
      <Row vertical="center" horizontal="between" wrap gap="s">
        <Heading variant="heading-strong-xl">Analisis de Portafolio</Heading>
        <Row gap="s" vertical="center">
          <Button size="s" variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cerrar" : "+ Movimiento"}
          </Button>
        </Row>
      </Row>

      {/* ── Period Filters ── */}
      <Row gap="xs" style={{ flexWrap: "wrap" }}>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            className={period === p.value ? "liquid-btn" : ""}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: "6px 14px",
              borderRadius: "0.75rem",
              border: period === p.value ? "1px solid var(--brand-medium)" : "1px solid var(--neutral-alpha-medium)",
              background: period === p.value ? "var(--brand-alpha-weak)" : "transparent",
              color: period === p.value ? "var(--brand-on-background-strong)" : "var(--neutral-on-background-weak)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
          >
            {p.label}
          </button>
        ))}
      </Row>

      {/* ── Add Movement Form ── */}
      {showForm && (
        <Card padding="m" radius="m" fillWidth className="liquid-glass-sm">
          <Column gap="m">
            <Heading variant="heading-strong-s">Nuevo Movimiento</Heading>
            <Grid columns="3" gap="m" s={{ columns: 1 }}>
              <Column gap="xs">
                <Text variant="label-default-xs" onBackground="neutral-weak">Tipo</Text>
                <select
                  className="liquid-select"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {MOVEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Column>
              <Column gap="xs">
                <Text variant="label-default-xs" onBackground="neutral-weak">Ticker</Text>
                <input
                  className="liquid-select"
                  placeholder="AAPL, SOFIPO, BTC..."
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                />
              </Column>
              <Column gap="xs">
                <Text variant="label-default-xs" onBackground="neutral-weak">Fecha</Text>
                <input
                  className="liquid-select"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Column>
              <Column gap="xs">
                <Text variant="label-default-xs" onBackground="neutral-weak">Monto Total</Text>
                <input
                  className="liquid-select"
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Column>
              <Column gap="xs">
                <Text variant="label-default-xs" onBackground="neutral-weak">Cantidad</Text>
                <input
                  className="liquid-select"
                  type="number"
                  placeholder="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </Column>
              <Column gap="xs">
                <Text variant="label-default-xs" onBackground="neutral-weak">Precio Unitario</Text>
                <input
                  className="liquid-select"
                  type="number"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </Column>
            </Grid>
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Notas</Text>
              <input
                className="liquid-select"
                placeholder="Opcional..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Column>
            <Button size="s" variant="primary" onClick={handleSubmit} style={{ alignSelf: "flex-start" }}>
              Guardar Movimiento
            </Button>
          </Column>
        </Card>
      )}

      {/* ── Summary Cards ── */}
      {summary && (
        <Grid columns="4" gap="m" l={{ columns: 2 }} s={{ columns: 2 }}>
          <Card padding="m" radius="m" fillWidth>
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Total Invertido</Text>
              <Text variant="heading-strong-m">{formatCurrency(summary.totalInvested)}</Text>
            </Column>
          </Card>
          <Card padding="m" radius="m" fillWidth>
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Total Retirado</Text>
              <Text variant="heading-strong-m">{formatCurrency(summary.totalWithdrawn)}</Text>
            </Column>
          </Card>
          <Card padding="m" radius="m" fillWidth>
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Flujo Neto</Text>
              <Text variant="heading-strong-m" onBackground={summary.netFlow >= 0 ? "success-strong" : "danger-strong"}>
                {formatCurrency(summary.netFlow)}
              </Text>
            </Column>
          </Card>
          <Card padding="m" radius="m" fillWidth>
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Movimientos</Text>
              <Text variant="heading-strong-m">{summary.totalMovements}</Text>
              <Row gap="s">
                <Badge textVariant="label-default-xs" color="success">{summary.buyCount} compras</Badge>
                <Badge textVariant="label-default-xs" color="danger">{summary.sellCount} ventas</Badge>
              </Row>
            </Column>
          </Card>
        </Grid>
      )}

      {/* ── Charts ── */}
      <div ref={chartRef}>
        <Grid columns="2" gap="m" l={{ columns: 1 }}>
          {/* Line/Area/Candlestick Chart - Portfolio Value */}
          <Card padding="m" radius="m" fillWidth>
            <Column gap="m">
              <Row vertical="center" horizontal="between">
                <Heading variant="heading-strong-s">Valor del Portafolio</Heading>
                <Row gap="xs">
                  <Row gap="xs">
                    {CHART_TYPES.map((ct) => (
                      <button
                        key={ct.value}
                        onClick={() => setChartType(ct.value as any)}
                        className={chartType === ct.value ? "liquid-btn" : ""}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "0.5rem",
                          border: chartType === ct.value ? "1px solid var(--brand-medium)" : "1px solid var(--neutral-alpha-medium)",
                          background: chartType === ct.value ? "var(--brand-alpha-weak)" : "transparent",
                          color: chartType === ct.value ? "var(--brand-on-background-strong)" : "var(--neutral-on-background-weak)",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          transition: "all 0.2s ease",
                        }}
                      >
                        {ct.label}
                      </button>
                    ))}
                  </Row>
                  <IconButton icon="download" size="xs" onClick={handleExportPng} tooltip="Exportar PNG" />
                </Row>
              </Row>
              <div style={CHART_GLASS_STYLE}>
                <ResponsiveContainer width="100%" height={280}>
                  {chartType === "area" ? (
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-medium)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255,255,255,0.04)",
                          backdropFilter: "blur(24px)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "0.75rem",
                          color: "var(--neutral-on-background-strong)",
                        }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="var(--brand-alpha-weak)" fillOpacity={0.3} />
                    </LineChart>
                  ) : (
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-medium)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255,255,255,0.04)",
                          backdropFilter: "blur(24px)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "0.75rem",
                          color: "var(--neutral-on-background-strong)",
                        }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Column>
          </Card>

          {/* Bar Chart - Monthly Breakdown */}
          <Card padding="m" radius="m" fillWidth>
            <Column gap="m">
              <Heading variant="heading-strong-s">Distribucion Mensual</Heading>
              <div style={CHART_GLASS_STYLE}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-medium)" />
                    <XAxis dataKey="month" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.04)",
                        backdropFilter: "blur(24px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "0.75rem",
                        color: "var(--neutral-on-background-strong)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Inversion" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Sofipos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Crypto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Column>
          </Card>

          {/* Pie Chart - By Ticker */}
          <Card padding="m" radius="m" fillWidth>
            <Column gap="m">
              <Heading variant="heading-strong-s">Por Activo</Heading>
              <div style={CHART_GLASS_STYLE}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const { name, value, percent } = payload[0].payload;
                        return (
                          <div style={{
                            background: "rgba(255,255,255,0.04)",
                            backdropFilter: "blur(24px)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "0.75rem",
                            padding: "12px 16px",
                            color: "var(--neutral-on-background-strong)",
                            minWidth: 160,
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{name}</div>
                            <div style={{ color: "var(--brand-on-background-strong)", fontSize: "1.1rem", fontWeight: 600 }}>
                              ${Number(value).toLocaleString()}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--neutral-on-background-weak)", marginTop: 4 }}>
                              {((percent ?? 0) * 100).toFixed(1)}% del portafolio
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Column>
          </Card>

          {/* Pie Chart - By Type */}
          <Card padding="m" radius="m" fillWidth>
            <Column gap="m">
              <Heading variant="heading-strong-s">Por Tipo de Movimiento</Heading>
              <div style={CHART_GLASS_STYLE}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={typePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {typePieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const { name, value, percent } = payload[0].payload;
                        return (
                          <div style={{
                            background: "rgba(255,255,255,0.04)",
                            backdropFilter: "blur(24px)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "0.75rem",
                            padding: "12px 16px",
                            color: "var(--neutral-on-background-strong)",
                            minWidth: 160,
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{name}</div>
                            <div style={{ color: "var(--brand-on-background-strong)", fontSize: "1.1rem", fontWeight: 600 }}>
                              ${Number(value).toLocaleString()}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--neutral-on-background-weak)", marginTop: 4 }}>
                              {((percent ?? 0) * 100).toFixed(1)}% del total
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Column>
          </Card>
        </Grid>
      </div>

      {/* ── Export Buttons ── */}
      <Row gap="s" wrap>
        <Button size="s" variant="secondary" onClick={handleExportPng}>
          Exportar Graficas PNG
        </Button>
        <Button size="s" variant="secondary" onClick={() => exportCsvDownload(csvHeaders, csvRows, `portafolio-${period}.csv`)}>
          Exportar CSV
        </Button>
        <Button size="s" variant="secondary" onClick={() => exportXlsxDownload(csvHeaders, csvRows, `portafolio-${period}.xlsx`)}>
          Exportar Excel
        </Button>
      </Row>

      {/* ── Movements History ── */}
      <Column gap="s">
        <Heading variant="heading-strong-m">Historial de Movimientos</Heading>
        {movements.length === 0 ? (
          <Card padding="l" radius="m" fillWidth>
            <Text variant="body-default-m" onBackground="neutral-weak" style={{ textAlign: "center" }}>
              No hay movimientos registrados. Agrega tu primer movimiento arriba.
            </Text>
          </Card>
        ) : (
          <Card padding="s" radius="m" fillWidth>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--neutral-alpha-medium)" }}>
                    {["Fecha", "Tipo", "Ticker", "Monto", "Cant.", "Precio", "Notas", ""].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--neutral-on-background-weak)", fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.slice(0, 50).map((m) => {
                    const typeInfo = MOVEMENT_TYPES.find((t) => t.value === m.type);
                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}>
                        <td style={{ padding: "8px 12px" }}>{m.date}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <Badge textVariant="label-default-xs" color={typeInfo?.color || "neutral"}>
                            {typeInfo?.label || m.type}
                          </Badge>
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{m.ticker}</td>
                        <td style={{ padding: "8px 12px" }}>{formatCurrency(m.amount)}</td>
                        <td style={{ padding: "8px 12px" }}>{m.quantity}</td>
                        <td style={{ padding: "8px 12px" }}>{formatCurrency(m.price)}</td>
                        <td style={{ padding: "8px 12px", color: "var(--neutral-on-background-weak)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.notes}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <button
                            onClick={() => deleteMovement(m.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-on-background-strong)", fontSize: "0.75rem" }}
                          >
                            x
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Column>
    </Column>
  );
}
