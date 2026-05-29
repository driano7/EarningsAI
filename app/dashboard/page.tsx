"use client";

import { useState } from "react";
import { Column, Grid, Row, Heading, Text, Badge, RevealFx, Icon, Card, Button, Input, Select } from "@once-ui-system/core";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartCarousel } from "@/components/charts/ChartCarousel";
import { useFinanceData } from "@/hooks/useFinanceData";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/formatFinance";

const CHART_COLORS = [
  "var(--chart-positive)",
  "var(--chart-negative)",
  "var(--chart-neutral)",
  "var(--brand-background-strong)",
  "var(--accent-background-strong)",
];

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
                <Icon name="trendingUp" size="m" onBackground={getChangeColor(data.monthlyChange) === "emerald" ? "success-weak" : "danger-weak"} />
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
                  <Text variant="label-default-xs" onBackground={changeColor === "emerald" ? "success-weak" : "danger-weak"}>
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

      {/* ── GRÁFICAS ── CAROUSEL ──────────────────────────── */}
      <ChartCarousel
        views={[
          {
            id: "portfolio-pie",
            label: "Portafolio",
            content: (
              <ChartCard title="Distribución del Portafolio" subtitle="Por activo" filename="portfolio-allocation">
                <Row gap="l" vertical="center" fillWidth wrap>
                  <div style={{ width: "55%", minWidth: 200, height: 280 }}>
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
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "var(--neutral-alpha-weak)",
                            border: "1px solid var(--neutral-alpha-medium)",
                            borderRadius: 8,
                            backdropFilter: "blur(12px)",
                          }}
                          formatter={(value) => [formatCurrency(Number(value)), "Valor"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <Column gap="s" style={{ flex: 1, minWidth: 160 }}>
                    {data.portfolioAllocation.map((item, i) => {
                      const pct = data.portfolioAllocation.reduce((s, a) => s + a.value, 0) > 0
                        ? (item.value / data.portfolioAllocation.reduce((s, a) => s + a.value, 0)) * 100
                        : 0;
                      return (
                        <Row key={item.ticker} gap="s" vertical="center">
                          <div style={{
                            width: 10, height: 10, borderRadius: 2,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                            flexShrink: 0,
                          }} />
                          <Text variant="body-default-s" style={{ flex: 1 }}>{item.ticker}</Text>
                          <Text variant="label-default-s">{formatCurrency(item.value)}</Text>
                          <Text variant="label-default-xs" onBackground="neutral-weak">({pct.toFixed(1)}%)</Text>
                        </Row>
                      );
                    })}
                  </Column>
                </Row>
              </ChartCard>
            ),
          },
          {
            id: "monthly-bar",
            label: "Balance Mensual",
            content: (
              <ChartCard title="Balance Mensual" subtitle="Ingresos vs Gastos (30d)" filename="monthly-balance" height={720}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-weak)" />
                    <XAxis dataKey="date" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--neutral-alpha-weak)",
                        border: "1px solid var(--neutral-alpha-medium)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="income" fill="var(--chart-positive)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="var(--chart-negative)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
                  <Text variant="label-strong-m" onBackground={getChangeColor(data.monthlyChange) === "emerald" ? "success-medium" : "danger-medium"}>
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
