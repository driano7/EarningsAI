"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, Card, Grid } from "@once-ui-system/core";

interface ExpenseItem {
  name: string;
  category: string;
  amount: number;
  pct: number;
}

interface IncomeItem {
  name: string;
  amount: number;
}

interface CategoryGroup {
  name: string;
  total: number;
  pct: number;
  items: ExpenseItem[];
}

interface ExpenseData {
  items: ExpenseItem[];
  income: IncomeItem[];
  categories: CategoryGroup[];
  totalExpenses: number;
  totalIncome: number;
  updatedAt: string;
}

export default function TransactionsPage() {
  const [data, setData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);

  const chatId = typeof window !== "undefined" ? localStorage.getItem("quartly_chatId") || "default" : "default";

  useEffect(() => {
    if (!chatId || chatId === "default") { setLoading(false); return; }
    fetch(`/api/expenses?chatId=${chatId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatId]);

  const balance = data ? data.totalIncome - data.totalExpenses : 0;

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Gastos Mensuales</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Resumen de gastos e ingresos del mes
        </Text>
      </Column>

      {loading ? (
        <Text>Cargando gastos...</Text>
      ) : !data ? (
        <Card padding="l" radius="m" fillWidth>
          <Column horizontal="center" gap="s" padding="l">
            <Text variant="body-default-m" onBackground="neutral-weak">
              No hay datos de gastos. Importa tus datos primero.
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              Despliega a Vercel y visita /api/import para cargar tus gastos desde el CSV.
            </Text>
          </Column>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <Grid columns="4" gap="m" l={{ columns: 2 }} s={{ columns: 1 }}>
            <Card padding="l" radius="m" fillWidth>
              <Column gap="s">
                <Text variant="body-default-s" onBackground="neutral-weak">Total Gastos</Text>
                <Heading variant="display-strong-xs">${data.totalExpenses.toLocaleString()}</Heading>
              </Column>
            </Card>
            <Card padding="l" radius="m" fillWidth>
              <Column gap="s">
                <Text variant="body-default-s" onBackground="neutral-weak">Total Ingresos</Text>
                <Heading variant="display-strong-xs">${data.totalIncome.toLocaleString()}</Heading>
              </Column>
            </Card>
            <Card padding="l" radius="m" fillWidth>
              <Column gap="s">
                <Text variant="body-default-s" onBackground="neutral-weak">Balance</Text>
                <Heading variant="display-strong-xs" onBackground={balance >= 0 ? "success-medium" : "danger-medium"}>
                  {balance >= 0 ? "+" : ""}${balance.toLocaleString()}
                </Heading>
              </Column>
            </Card>
            <Card padding="l" radius="m" fillWidth>
              <Column gap="s">
                <Text variant="body-default-s" onBackground="neutral-weak">Tasa de Ahorro</Text>
                <Heading variant="display-strong-xs" onBackground={balance >= 0 ? "success-medium" : "danger-medium"}>
                  {data.totalIncome > 0 ? `${((balance / data.totalIncome) * 100).toFixed(1)}%` : "—"}
                </Heading>
              </Column>
            </Card>
          </Grid>

          {/* Expenses by Category */}
          <Heading variant="heading-strong-m">Gastos por Categoría</Heading>
          <Grid columns="3" gap="m" l={{ columns: 2 }} s={{ columns: 1 }}>
            {data.categories.map((cat) => {
              const barWidth = data.totalExpenses > 0 ? (cat.total / data.totalExpenses) * 100 : 0;
              return (
                <Card key={cat.name} padding="m" radius="m" fillWidth>
                  <Column gap="s">
                    <Row vertical="center" horizontal="between">
                      <Text variant="heading-strong-s">{cat.name}</Text>
                      <Badge textVariant="label-default-s" color="brand">{cat.pct.toFixed(1)}%</Badge>
                    </Row>
                    <div style={{
                      height: 6, borderRadius: 3,
                      background: "var(--neutral-alpha-weak)",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${barWidth}%`, height: "100%",
                        background: "var(--brand-on-background-strong)",
                        borderRadius: 3,
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <Text variant="heading-strong-m">${cat.total.toLocaleString()}</Text>
                    <Column gap="xs">
                      {cat.items.map((item) => (
                        <Row key={item.name} vertical="center" horizontal="between">
                          <Text variant="body-default-s" onBackground="neutral-weak">{item.name}</Text>
                          <Text variant="label-default-s">${item.amount.toLocaleString()}</Text>
                        </Row>
                      ))}
                    </Column>
                  </Column>
                </Card>
              );
            })}
          </Grid>

          {/* Income Sources */}
          <Heading variant="heading-strong-m">Ingresos</Heading>
          <Card padding="m" radius="m" fillWidth>
            <Column gap="s">
              {data.income.map((inc) => (
                <Row key={inc.name} vertical="center" horizontal="between">
                  <Text variant="body-default-m">{inc.name}</Text>
                  <Text variant="label-default-l" onBackground="success-medium">+${inc.amount.toLocaleString()}</Text>
                </Row>
              ))}
              <div style={{ height: 1, background: "var(--neutral-alpha-weak)", margin: "4px 0" }} />
              <Row vertical="center" horizontal="between">
                <Text variant="label-strong-s">Total Ingresos</Text>
                <Text variant="label-strong-l" onBackground="success-medium">+${data.totalIncome.toLocaleString()}</Text>
              </Row>
            </Column>
          </Card>

          {/* Summary */}
          <Card padding="m" radius="m" fillWidth>
            <Column gap="s">
              <Text variant="heading-strong-s">Resumen</Text>
              <Grid columns="3" gap="m" l={{ columns: 2 }} s={{ columns: 1 }}>
                <Column gap="xs">
                  <Text variant="label-default-xs" onBackground="neutral-weak">Categoría con más gasto</Text>
                  <Text variant="label-strong-m">
                    {data.categories.sort((a, b) => b.total - a.total)[0]?.name || "—"}
                  </Text>
                </Column>
                <Column gap="xs">
                  <Text variant="label-default-xs" onBackground="neutral-weak">Gasto promedio por categoría</Text>
                  <Text variant="label-strong-m">
                    ${(data.totalExpenses / Math.max(data.categories.length, 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </Column>
                <Column gap="xs">
                  <Text variant="label-default-xs" onBackground="neutral-weak">Artículos registrados</Text>
                  <Text variant="label-strong-m">{data.items.length}</Text>
                </Column>
              </Grid>
            </Column>
          </Card>

          <Text variant="label-default-xs" onBackground="neutral-weak">
            📋 Gastos del mes basados en tu CSV · Importa con /api/import en producción
          </Text>
        </>
      )}
    </Column>
  );
}
