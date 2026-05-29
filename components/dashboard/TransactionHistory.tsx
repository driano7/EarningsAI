/*
 * Quartly Bot — components/dashboard/TransactionHistory.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useMemo } from "react";
import { Column, Flex, Text, Button, Input } from "@once-ui-system/core";
import type { Transaction } from "@/lib/types";

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const [filterTicker, setFilterTicker] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filtered = useMemo(() => {
    let items = [...transactions];

    if (filterTicker.trim()) {
      const q = filterTicker.toUpperCase();
      items = items.filter((t) => t.ticker.toUpperCase().includes(q));
    }

    if (filterType !== "all") {
      items = items.filter((t) => t.type === filterType);
    }

    if (filterDateFrom) {
      items = items.filter((t) => t.date >= filterDateFrom);
    }

    if (filterDateTo) {
      items = items.filter((t) => t.date <= filterDateTo);
    }

    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [transactions, filterTicker, filterType, filterDateFrom, filterDateTo]);

  function exportCsv() {
    const headers = ["Ticker", "Tipo", "Precio", "Cantidad", "Fecha", "Notas"];
    const rows = filtered.map((t) => [
      t.ticker,
      t.type === "buy" ? "Compra" : "Venta",
      t.price.toFixed(2),
      t.quantity,
      t.date,
      t.notes || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Column gap="l">
      <Flex horizontal="between" wrap gap="m">
        <Flex gap="m" wrap vertical="end">
          <Column gap="xs">
            <Text variant="body-default-xs" onBackground="neutral-weak">Ticker</Text>
            <Input
              id="filter-ticker"
              value={filterTicker}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterTicker(e.target.value)}
              placeholder="Filtrar..."
              style={{ minWidth: 140 }}
            />
          </Column>
          <Column gap="xs">
            <Text variant="body-default-xs" onBackground="neutral-weak">Tipo</Text>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--neutral-alpha-medium)",
                background: "var(--neutral-surface)",
                color: "var(--neutral-on-background-strong)",
                fontSize: 14,
                outline: "none",
                height: 36,
                boxSizing: "border-box",
              }}
            >
              <option value="all">Todos</option>
              <option value="buy">Compra</option>
              <option value="sell">Venta</option>
            </select>
          </Column>
          <Column gap="xs">
            <Text variant="body-default-xs" onBackground="neutral-weak">Desde</Text>
            <Input
              id="filter-date-from"
              type="date"
              value={filterDateFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDateFrom(e.target.value)}
            />
          </Column>
          <Column gap="xs">
            <Text variant="body-default-xs" onBackground="neutral-weak">Hasta</Text>
            <Input
              id="filter-date-to"
              type="date"
              value={filterDateTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDateTo(e.target.value)}
            />
          </Column>
        </Flex>
        <Button variant="secondary" onClick={exportCsv}>
          📥 Exportar CSV
        </Button>
      </Flex>

      <Flex
        fillWidth
        style={{
          overflowX: "auto",
          borderRadius: 12,
          border: "1px solid var(--neutral-alpha-weak)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}>
              <Th>Fecha</Th>
              <Th>Ticker</Th>
              <Th>Tipo</Th>
              <Th>Precio</Th>
              <Th>Cantidad</Th>
              <Th>Notas</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center" }}>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    No hay transacciones que coincidan.
                  </Text>
                </td>
              </tr>
            ) : (
              filtered.map((txn) => {
                const isBuy = txn.type === "buy";
                return (
                  <tr
                    key={txn.id}
                    style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-s">{txn.date}</Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-m" style={{ fontWeight: 600 }}>{txn.ticker}</Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text
                        variant="body-default-s"
                        style={{ color: isBuy ? "#00D084" : "#FF4D4D", fontWeight: 600 }}
                      >
                        {isBuy ? "COMPRA" : "VENTA"}
                      </Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-m">${txn.price.toFixed(2)}</Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-m">{txn.quantity}</Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-s" onBackground="neutral-weak">
                        {txn.notes || "—"}
                      </Text>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Flex>

      <Text variant="body-default-xs" onBackground="neutral-weak">
        Mostrando {filtered.length} de {transactions.length} transacciones
      </Text>
    </Column>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        textAlign: "left",
        color: "var(--neutral-on-background-weak)",
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </th>
  );
}
