"use client";

import { Column, Grid, Row, Heading, Text, Badge, RevealFx, Icon } from "@once-ui-system/core";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
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
  const { data, loading, error } = useFinanceData();

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
            Actualizado hace 5 min
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
            <Icon name="trendingUp" size="m" onBackground={getChangeColor(data.monthlyChange) === "emerald" ? "success-weak" : "danger-weak"} />
            <Text variant="body-default-m" onBackground="neutral-weak">
              {formatPercent(data.monthlyChange)} este mes
            </Text>
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
                <Text variant="label-default-xs" onBackground={changeColor === "emerald" ? "success-weak" : "danger-weak"}>
                  {kpi.change > 0 ? "+" : ""}{kpi.change}%
                </Text>
              </Column>
            </RevealFx>
          );
        })}
      </Grid>

      {/* ── GRÁFICA DE PORTAFOLIO ──────────────────────────── */}
      <Grid columns="2" gap="16" fillWidth s={{ columns: 1 }}>
        <ChartCard title="Distribución del Portafolio" subtitle="Por activo" filename="portfolio-allocation">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.portfolioAllocation}
                dataKey="value"
                nameKey="ticker"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
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
        </ChartCard>

        <ChartCard title="Balance Mensual" subtitle="Ingresos vs Gastos (30d)" filename="monthly-balance">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-weak)" />
              <XAxis dataKey="date" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }} />
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
      </Grid>

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
