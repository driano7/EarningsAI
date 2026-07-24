/*
 * Quartly Bot — page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useMemo } from "react";
import { Column, Grid, Row, Heading, Text, Badge, RevealFx, Icon, Card, Button, Input, Select } from "@once-ui-system/core";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartCarousel } from "@/components/charts/ChartCarousel";
import { MacroStrip } from "@/components/dashboard/MacroStrip";
import { useFinanceData } from "@/hooks/useFinanceData";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/formatFinance";
import { CATEGORY_PALETTE, CHART_COLORS, getRandomBarColor, CHART_GLASS_STYLE } from "@/lib/chartColors";

export default function DashboardPage() {
  const { data, loading, error, refetch } = useFinanceData();
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  const chatId = typeof window !== "undefined"
    ? localStorage.getItem("quartly_chatId") || "default"
    : "default";

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0 || !txCategory) return;
    setTxLoading(true);
    try {
      const res = await fetch(`/api/dashboard/transactions?chatId=${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txType,
          ticker: txType === "expense" ? txCategory.toUpperCase() : txCategory.toUpperCase(),
          price: amount,
          quantity: 1,
          date: new Date().toISOString().split("T")[0],
          notes: txDesc || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTxAmount("");
        setTxCategory("");
        setTxDesc("");
        refetch();
      }
    } catch { /* ignore */ }
    setTxLoading(false);
  }

  if (loading) {
    return (
      <Column horizontal="center" paddingY="80" gap="m">
        <Icon name="sparkles" size="l" />
        <Text variant="body-default-m" onBackground="neutral-weak">Cargando datos financieros...</Text>
      </Column>
    );
  }

  if (error || !data) {
    return (
      <Column horizontal="center" paddingY="80" gap="m">
        <Icon name="signal" size="l" onBackground="danger-weak" />
        <Text variant="body-default-m" onBackground="danger-weak">{error || "No hay datos disponibles"}</Text>
      </Column>
    );
  }

  return (
    <Column maxWidth="m" horizontal="center" gap="24">

      {/* ── HERO — Balance total ────────────────────────────── */}
      <Column paddingY="40" horizontal="center" gap="24" fillWidth>
        <RevealFx translateY="4">
          <Badge background="brand-alpha-medium" onBackground="brand-strong" paddingX="12" paddingY="4">
            {new Date(data.updatedAt).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" })}
          </Badge>
        </RevealFx>
        <RevealFx translateY="8" delay={0.1}>
          <Column horizontal="center" fillWidth>
            <Heading as="h1" variant="display-strong-xl">
              {formatCurrency(data.balance)}
            </Heading>
          </Column>
        </RevealFx>
        <RevealFx translateY="8" delay={0.2}>
          <Row gap="8" vertical="center">
            {data.monthlyChange !== null && (
              <>
                <Icon name="trendingUp" size="m" onBackground={getChangeColor(data.monthlyChange) === "success" ? "success-weak" : "danger-weak"} />
                <Text variant="body-default-m" onBackground="neutral-weak">
                  {formatPercent(data.monthlyChange)} este mes
                </Text>
              </>
            )}
          </Row>
        </RevealFx>
      </Column>

      {/* ── KPI CARDS ──────────────────────────────────────── */}
      <Grid columns="4" gap="16" fillWidth l={{ columns: 2 }} s={{ columns: 1 }}>
        {data.kpis.map((kpi) => {
          const changeColor = getChangeColor(kpi.change);
          return (
            <RevealFx key={kpi.label} translateY="8" delay={0.1}>
              <Column padding="24" background="surface" border="neutral-alpha-medium" radius="l" gap="8">
                <Row gap="8" vertical="center">
                  <Icon name={kpi.icon as never} size="s" />
                  <Text variant="label-default-s" onBackground="neutral-weak">{kpi.label}</Text>
                </Row>
                <Heading variant="heading-strong-m">{kpi.value}</Heading>
                {kpi.change !== null && (
                  <Text variant="label-default-xs" onBackground={changeColor === "success" ? "success-weak" : "danger-weak"}>
                    {kpi.change > 0 ? "+" : ""}{kpi.change}%
                  </Text>
                )}
              </Column>
            </RevealFx>
          );
        })}
      </Grid>

      {/* ── QUICK ADD ── INGRESO / GASTO ──────────────────── */}
      <RevealFx translateY="8" delay={0.15}>
        <Card padding="l" radius="m" fillWidth>
          <Column gap="16">
            <Row gap="16" vertical="center">
              <Heading variant="heading-strong-m">Registrar Movimiento</Heading>
            </Row>
            <Grid columns="4" gap="16" fillWidth s={{ columns: 1 }}>
              <Select
                id="tx-type"
                options={[
                  { label: "💰 Ingreso", value: "income" },
                  { label: "💸 Gasto", value: "expense" },
                ]}
                value={txType}
                onSelect={(v) => setTxType(v as "income" | "expense")}
                placeholder="Tipo"
              />
              <Input
                id="tx-amount"
                label="Monto"
                type="number"
                placeholder="0.00"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
              <Input
                id="tx-category"
                label="Categoría"
                placeholder="Ej: Comida, Salario"
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
              />
              <Input
                id="tx-desc"
                label="Descripción"
                placeholder="Opcional"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
              />
            </Grid>
            <Button onClick={addTransaction} disabled={!txAmount || !txCategory || txLoading}>
              {txLoading ? "Guardando..." : `Agregar ${txType === "income" ? "Ingreso" : "Gasto"}`}
            </Button>
          </Column>
        </Card>
      </RevealFx>

      {/* ── MACRO STRIP ─────────────────────────────────────── */}
      <MacroStrip />

      {/* ── GRÁFICAS ── CAROUSEL ──────────────────────────── */}
      <ChartCarousel
        views={[
          {
            id: "portfolio-pie",
            label: "Portafolio",
            content: (
              <ChartCard title="Distribución del Portafolio" subtitle="Por activo" filename="portfolio-allocation">
                <Row gap="l" vertical="center" fillWidth wrap>
                  <Column style={{ width: "50%", minWidth: 200, height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.portfolioAllocation}
                          dataKey="value"
                          nameKey="ticker"
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={90}
                          paddingAngle={2}
                        >
                          {data.portfolioAllocation.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
                          ))}
                        </Pie>
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
                          formatter={(value) => [formatCurrency(Number(value)), "Valor"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Column>
                  <Column gap="m" style={{ flex: 1, minWidth: 200 }}>
                    {(() => {
                      const sorted = [...data.portfolioAllocation].sort((a, b) => b.value - a.value);
                      const mid = Math.ceil(sorted.length / 2);
                      const total = sorted.reduce((s, a) => s + a.value, 0);
                      const cols = [sorted.slice(0, mid), sorted.slice(mid)];
                      return (
                        <Row gap="l" fillWidth>
                          {cols.map((col, ci) => (
                            <Column key={ci} gap="s" fillWidth>
                              {col.map((item, i) => {
                                const idx = sorted.indexOf(item);
                                const pct = total > 0 ? (item.value / total) * 100 : 0;
                                return (
                                  <Row key={item.ticker} gap="xs" vertical="center" fillWidth>
                                    <Column
                                      style={{
                                        width: 8, height: 8, borderRadius: 2,
                                        background: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
                                        flexShrink: 0,
                                      }}
                                    />
                                    <Text variant="body-default-s" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.ticker}</Text>
                                    <Text variant="label-default-s" style={{ whiteSpace: "nowrap" }}>{formatCurrency(item.value)}</Text>
                                    <Text variant="label-default-xs" onBackground="neutral-weak" style={{ whiteSpace: "nowrap" }}>({pct.toFixed(1)}%)</Text>
                                  </Row>
                                );
                              })}
                            </Column>
                          ))}
                        </Row>
                      );
                    })()}
                  </Column>
                </Row>
              </ChartCard>
            ),
          },
          {
            id: "monthly-bar",
            label: "Balance Mensual",
            content: (
              <ChartCard title="Balance Mensual" subtitle="Ingresos vs Gastos" filename="monthly-balance" height={400}>
                <div style={CHART_GLASS_STYLE}>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={data.monthlyFinance.length > 0 ? data.monthlyFinance : [{ month: "Sin datos", income: 0, expense: 0 }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 12 }} />
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
                        formatter={(value) => [formatCurrency(Number(value)), ""]}
                      />
                      <Bar dataKey="income" name="Ingresos" radius={[4, 4, 0, 0]}>
                        {data.monthlyFinance.map((_, i) => (
                          <Cell key={`inc-${i}`} fill={getRandomBarColor(i * 2)} />
                        ))}
                      </Bar>
                      <Bar dataKey="expense" name="Gastos" radius={[4, 4, 0, 0]}>
                        {data.monthlyFinance.map((_, i) => (
                          <Cell key={`exp-${i}`} fill={getRandomBarColor(i * 2 + 1)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            ),
          },
        ]}
      />

      {/* ── PORTFOLIO HEALTH ──────────────────────────────── */}
      {data.portfolioAllocation.length > 0 && (
        <RevealFx translateY="8" delay={0.18}>
          <Card padding="l" radius="m" fillWidth>
            <Column gap="m">
              <Row gap="m" vertical="center">
                <Icon name="chart" size="s" />
                <Heading variant="heading-strong-m">Salud del Portafolio</Heading>
              </Row>
              <Grid columns="4" gap="m" l={{ columns: 2 }} s={{ columns: 2 }}>
                <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
                  <Text variant="label-default-xs" onBackground="neutral-weak">Holdings</Text>
                  <Text variant="label-strong-m">{data.portfolioAllocation.length}</Text>
                </Column>
                <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
                  <Text variant="label-default-xs" onBackground="neutral-weak">Balance Total</Text>
                  <Text variant="label-strong-m">{formatCurrency(data.balance)}</Text>
                </Column>
                <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
                  <Text variant="label-default-xs" onBackground="neutral-weak">Cambio Mensual</Text>
                  <Text variant="label-strong-m" onBackground={getChangeColor(data.monthlyChange) === "success" ? "success-medium" : "danger-medium"}>
                    {data.monthlyChange !== null ? formatPercent(data.monthlyChange) : "—"}
                  </Text>
                </Column>
                <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
                  <Text variant="label-default-xs" onBackground="neutral-weak">Concentración</Text>
                  <Text variant="label-strong-m">
                    {(() => {
                      const total = data.portfolioAllocation.reduce((s, a) => s + a.value, 0);
                      const hhi = data.portfolioAllocation.reduce((s, a) => s + (a.value / total) ** 2, 0);
                      return hhi > 0.5 ? "🔴 Alta" : hhi > 0.25 ? "🟡 Media" : "🟢 Baja";
                    })()}
                  </Text>
                </Column>
              </Grid>
            </Column>
          </Card>
        </RevealFx>
      )}

      {/* ── LISTA DE ÚLTIMAS TRANSACCIONES ─────────────────── */}
      <Column gap="-1" fillWidth>
        <RevealFx translateY="8" delay={0.2}>
          <Row padding="16" gap="12" vertical="center">
            <Icon name="transactions" size="s" />
            <Heading variant="heading-strong-m">Últimos Movimientos</Heading>
          </Row>
        </RevealFx>

        {data.recentTransactions.length === 0 ? (
          <Column padding="40" horizontal="center" gap="m">
            <Text variant="body-default-m" onBackground="neutral-weak">Sin movimientos recientes</Text>
          </Column>
        ) : (
          <Column gap="-1" fillWidth>
            {data.recentTransactions.map((tx) => {
              const isBuy = tx.type === "buy";
              return (
                <RevealFx key={tx.id} translateY="4">
                  <Row padding="16" background="surface" border="neutral-alpha-weak" vertical="center" fillWidth>
                    <Row gap="12" fillWidth vertical="center">
                      <Icon
                        name={isBuy ? "trendingUp" : "trendingDown"}
                        background={isBuy ? "success-alpha-weak" : "danger-alpha-weak"}
                        padding="8"
                        radius="m"
                      />
                      <Column gap="4">
                        <Text variant="label-strong-s">{tx.ticker}</Text>
                        <Text variant="label-default-xs" onBackground="neutral-weak">{tx.date}</Text>
                      </Column>
                    </Row>
                    <Text
                      variant="label-strong-m"
                      onBackground={isBuy ? "success-medium" : "danger-medium"}
                    >
                      {isBuy ? "+" : "-"}{formatCurrency(tx.price * tx.quantity)}
                    </Text>
                  </Row>
                </RevealFx>
              );
            })}
          </Column>
        )}
      </Column>
    </Column>
  );
}
