/*
 * Quartly Bot — page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, Card, Grid, Button, Input, IconButton } from "@once-ui-system/core";

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

  // Add expense form
  const [newExpense, setNewExpense] = useState({ name: "", category: "General", amount: "" });
  const [newIncome, setNewIncome] = useState({ name: "", amount: "" });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editExpense, setEditExpense] = useState({ name: "", category: "", amount: "" });
  const [editIncomeIdx, setEditIncomeIdx] = useState<number | null>(null);
  const [editIncome, setEditIncome] = useState({ name: "", amount: "" });

  const chatId = typeof window !== "undefined" ? localStorage.getItem("quartly_chatId") || "default" : "default";

  async function fetchData() {
    if (!chatId || chatId === "default") { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/expenses?chatId=${chatId}`);
      const d = await r.json();
      if (d.ok) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [chatId]);

  async function addExpense() {
    if (!newExpense.name || !newExpense.amount) return;
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, type: "expense", ...newExpense, amount: Number(newExpense.amount) }),
    });
    setNewExpense({ name: "", category: "General", amount: "" });
    fetchData();
  }

  async function addIncome() {
    if (!newIncome.name || !newIncome.amount) return;
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, type: "income", ...newIncome, amount: Number(newIncome.amount) }),
    });
    setNewIncome({ name: "", amount: "" });
    fetchData();
  }

  async function updateExpense(idx: number) {
    await fetch("/api/expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, type: "expense", index: idx, ...editExpense }),
    });
    setEditingIdx(null);
    fetchData();
  }

  async function updateIncome(idx: number) {
    await fetch("/api/expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, type: "income", index: idx, name: editIncome.name, amount: Number(editIncome.amount) }),
    });
    setEditIncomeIdx(null);
    fetchData();
  }

  async function deleteExpense(idx: number) {
    await fetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, type: "expense", index: idx }),
    });
    fetchData();
  }

  async function deleteIncome(idx: number) {
    await fetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, type: "income", index: idx }),
    });
    fetchData();
  }

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
        <Text>Cargando...</Text>
      ) : !data ? (
        <Card padding="l" radius="m" fillWidth>
          <Column horizontal="center" gap="s" padding="l">
            <Text variant="body-default-m" onBackground="neutral-weak">
              No hay datos de gastos. Importa tus datos con /api/import en producción.
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
                    <Column
                      style={{
                        height: 6, borderRadius: 3,
                        background: "var(--neutral-alpha-weak)",
                        overflow: "hidden",
                      }}
                    >
                      <Column
                        style={{
                          width: `${barWidth}%`, height: "100%",
                          background: "var(--brand-on-background-strong)",
                          borderRadius: 3,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </Column>
                    <Text variant="heading-strong-m">${cat.total.toLocaleString()}</Text>
                    <Column gap="xs">
                      {cat.items.map((item, i) => {
                        const globalIdx = data.items.indexOf(item);
                        return (
                          <Row key={item.name} vertical="center" horizontal="between" wrap gap="s">
                            {editingIdx === globalIdx ? (
                              <Row gap="s" vertical="center" wrap>
                                <Input
                                  id={`edit-name-${globalIdx}`}
                                  value={editExpense.name}
                                  onChange={(e) => setEditExpense({ ...editExpense, name: e.target.value })}
                                  style={{ minWidth: 100 }}
                                />
                                <Input
                                  id={`edit-cat-${globalIdx}`}
                                  value={editExpense.category}
                                  onChange={(e) => setEditExpense({ ...editExpense, category: e.target.value })}
                                  style={{ minWidth: 80 }}
                                />
                                <Input
                                  id={`edit-amt-${globalIdx}`}
                                  type="number"
                                  value={editExpense.amount}
                                  onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })}
                                  style={{ minWidth: 60 }}
                                />
                                <Button size="s" onClick={() => updateExpense(globalIdx)}>Guardar</Button>
                                <Button size="s" variant="secondary" onClick={() => setEditingIdx(null)}>X</Button>
                              </Row>
                            ) : (
                              <>
                                <Text variant="body-default-s" onBackground="neutral-weak">{item.name}</Text>
                                <Row gap="s" vertical="center">
                                  <Text variant="label-default-s">${item.amount.toLocaleString()}</Text>
                                  <IconButton icon="edit" size="s" variant="tertiary" onClick={() => { setEditingIdx(globalIdx); setEditExpense({ name: item.name, category: item.category, amount: String(item.amount) }); }} tooltip="Editar" />
                                  <IconButton icon="trash" size="s" variant="danger" onClick={() => deleteExpense(globalIdx)} tooltip="Eliminar" />
                                </Row>
                              </>
                            )}
                          </Row>
                        );
                      })}
                    </Column>
                  </Column>
                </Card>
              );
            })}
          </Grid>

          {/* Add Expense */}
          <Card padding="m" radius="m" fillWidth>
            <Column gap="s">
              <Text variant="heading-strong-s">Agregar Gasto</Text>
              <Row gap="s" vertical="center" wrap>
                <Input id="add-exp-name" label="Nombre" value={newExpense.name} onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })} style={{ minWidth: 140 }} />
                <Input id="add-exp-cat" label="Categoría" value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} style={{ minWidth: 120 }} />
                <Input id="add-exp-amt" label="Monto" type="number" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} style={{ minWidth: 100 }} />
                <Button onClick={addExpense} disabled={!newExpense.name || !newExpense.amount}>+ Agregar</Button>
              </Row>
            </Column>
          </Card>

          {/* Income */}
          <Heading variant="heading-strong-m">Ingresos</Heading>
          <Card padding="m" radius="m" fillWidth>
            <Column gap="s">
              {data.income.map((inc, i) => (
                <Row key={inc.name} vertical="center" horizontal="between" wrap gap="s">
                  {editIncomeIdx === i ? (
                    <Row gap="s" vertical="center" wrap>
                      <Input id={`inc-name-${i}`} value={editIncome.name} onChange={(e) => setEditIncome({ ...editIncome, name: e.target.value })} style={{ minWidth: 120 }} />
                      <Input id={`inc-amt-${i}`} type="number" value={editIncome.amount} onChange={(e) => setEditIncome({ ...editIncome, amount: e.target.value })} style={{ minWidth: 80 }} />
                      <Button size="s" onClick={() => updateIncome(i)}>Guardar</Button>
                      <Button size="s" variant="secondary" onClick={() => setEditIncomeIdx(null)}>X</Button>
                    </Row>
                  ) : (
                    <>
                      <Text variant="body-default-m">{inc.name}</Text>
                      <Row gap="s" vertical="center">
                        <Text variant="label-default-l" onBackground="success-medium">+${inc.amount.toLocaleString()}</Text>
                        <IconButton icon="edit" size="s" variant="tertiary" onClick={() => { setEditIncomeIdx(i); setEditIncome({ name: inc.name, amount: String(inc.amount) }); }} tooltip="Editar" />
                        <IconButton icon="trash" size="s" variant="danger" onClick={() => deleteIncome(i)} tooltip="Eliminar" />
                      </Row>
                    </>
                  )}
                </Row>
              ))}
              <Column style={{ height: 1, background: "var(--neutral-alpha-weak)", margin: "4px 0" }} />
              <Row vertical="center" horizontal="between">
                <Text variant="label-strong-s">Total Ingresos</Text>
                <Text variant="label-strong-l" onBackground="success-medium">+${data.totalIncome.toLocaleString()}</Text>
              </Row>
            </Column>
          </Card>

          {/* Add Income */}
          <Card padding="m" radius="m" fillWidth>
            <Column gap="s">
              <Text variant="heading-strong-s">Agregar Ingreso</Text>
              <Row gap="s" vertical="center" wrap>
                <Input id="add-inc-name" label="Nombre" value={newIncome.name} onChange={(e) => setNewIncome({ ...newIncome, name: e.target.value })} style={{ minWidth: 140 }} />
                <Input id="add-inc-amt" label="Monto" type="number" value={newIncome.amount} onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })} style={{ minWidth: 100 }} />
                <Button onClick={addIncome} disabled={!newIncome.name || !newIncome.amount}>+ Agregar</Button>
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
            📋 Datos guardados en KV · Los cambios persisten
          </Text>
        </>
      )}
    </Column>
  );
}
