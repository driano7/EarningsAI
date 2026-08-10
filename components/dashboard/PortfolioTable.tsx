/*
 * Quartly Bot — components/dashboard/PortfolioTable.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Column, Flex, Text, Button, IconButton, Input } from "@once-ui-system/core";
import type { PortfolioPosition } from "@/lib/types";

interface PortfolioTableProps {
  positions: PortfolioPosition[];
  onEdit: (position: PortfolioPosition) => void;
  onDelete: (id: string) => void;
  onSell: (position: PortfolioPosition) => void;
  onRefresh: () => void;
}

type PositionType = "stock" | "etf" | "crypto" | "sofipo" | "cetes";

interface PositionWithPrice extends PortfolioPosition {
  currentPrice: number | null;
  change1d: number | null;
  pnl: number | null;
  pnlPercent: number | null;
}

const TYPE_LABELS: Record<PositionType, string> = {
  stock: "Acción",
  etf: "ETF",
  crypto: "Cripto",
  sofipo: "🏦 SOFIPO",
  cetes: "📜 CETES",
};

function isSavingsType(type: PositionType): boolean {
  return type === "sofipo" || type === "cetes";
}

export default function PortfolioTable({ positions, onEdit, onDelete, onSell, onRefresh }: PortfolioTableProps) {
  const [pricedPositions, setPricedPositions] = useState<PositionWithPrice[]>([]);
  const [sortKey, setSortKey] = useState<string>("ticker");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchPrices() {
      const enriched: PositionWithPrice[] = [];
      for (const pos of positions) {
        let currentPrice: number | null = null;
        let change1d: number | null = null;

        if (isSavingsType(pos.type)) {
          currentPrice = pos.buyPrice;
        } else {
          try {
            const res = await fetch(`/api/finance/price?ticker=${pos.ticker}`);
            const json = await res.json();
            if (json.ok) {
              currentPrice = json.data.current;
              change1d = json.data.change1d;
            }
          } catch { /* ignore */ }
        }

        const pnl = currentPrice !== null && !isSavingsType(pos.type)
          ? (currentPrice - pos.buyPrice) * pos.quantity
          : null;
        const pnlPercent = currentPrice !== null && !isSavingsType(pos.type)
          ? ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100
          : null;

        enriched.push({ ...pos, currentPrice, change1d, pnl, pnlPercent });
      }
      setPricedPositions(enriched);
    }
    fetchPrices();
  }, [positions]);

  const filtered = useMemo(() => {
    let items = [...pricedPositions];

    if (filterType !== "all") {
      items = items.filter((p) => p.type === filterType);
    }

    if (search.trim()) {
      const q = search.toUpperCase();
      items = items.filter((p) => p.ticker.toUpperCase().includes(q));
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "ticker":
          cmp = a.ticker.localeCompare(b.ticker);
          break;
        case "pnlPercent":
          cmp = (a.pnlPercent ?? 0) - (b.pnlPercent ?? 0);
          break;
        case "currentPrice":
          cmp = (a.currentPrice ?? 0) - (b.currentPrice ?? 0);
          break;
        default:
          cmp = a.ticker.localeCompare(b.ticker);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [pricedPositions, filterType, search, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const totalValue = pricedPositions.reduce(
    (sum, p) => sum + (p.currentPrice ?? 0) * p.quantity,
    0
  );
  const totalCost = pricedPositions.reduce(
    (sum, p) => sum + p.buyPrice * p.quantity,
    0
  );
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const totalColor = totalPnl >= 0 ? "var(--success-medium)" : "var(--danger-medium)";

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <Column gap="l">
      <Flex
        padding="l"
        radius="m"
        vertical="center"
        horizontal="between"
        className="liquid-glass"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Column gap="xs">
          <Text variant="body-default-s" onBackground="neutral-weak">Valor total del portafolio</Text>
          <Text variant="display-strong-xs">${totalValue.toFixed(2)}</Text>
        </Column>
        <Column gap="xs" horizontal="center">
          <Text variant="body-default-s" onBackground="neutral-weak">P&L Total</Text>
          <Text variant="label-default-l" style={{ color: totalColor, fontWeight: 600 }}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} ({totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%)
          </Text>
        </Column>
      </Flex>

      <Flex gap="m" vertical="center" wrap>
        <Input
          id="search-ticker"
          label="Buscar"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          placeholder="Filtrar por ticker..."
          style={{ minWidth: 200 }}
        />
        <Column gap="xs">
          <Text variant="body-default-xs" onBackground="neutral-weak">Tipo</Text>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="liquid-select"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--neutral-alpha-medium)",
              background: "var(--neutral-surface)",
              color: "var(--neutral-on-background-strong)",
              fontSize: 14,
              outline: "none",
            }}
          >
            <option value="all">Todos</option>
            <option value="stock">Acciones</option>
            <option value="etf">ETFs</option>
            <option value="crypto">Cripto</option>
            <option value="sofipo">🏦 SOFIPO</option>
            <option value="cetes">📜 CETES</option>
          </select>
        </Column>
      </Flex>

      <Flex
        fillWidth
        className="glass-card"
        style={{
          overflowX: "auto",
          borderRadius: 12,
          border: "1px solid var(--neutral-alpha-weak)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}>
              <Th onClick={() => toggleSort("ticker")}>Nombre{sortIndicator("ticker")}</Th>
              <Th>Tipo</Th>
              <Th>Monto</Th>
              <Th>Vence</Th>
              <Th>Condiciones</Th>
              <Th onClick={() => toggleSort("currentPrice")}>Valor actual{sortIndicator("currentPrice")}</Th>
              <Th onClick={() => toggleSort("pnlPercent")}>Rendimiento{sortIndicator("pnlPercent")}</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center" }}>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    No hay posiciones que coincidan con los filtros.
                  </Text>
                </td>
              </tr>
            ) : (
              filtered.map((pos) => {
                const savings = isSavingsType(pos.type);
                const pnlColor = pos.pnl === null
                  ? "var(--neutral-on-background-weak)"
                  : pos.pnl >= 0
                    ? "var(--success-medium)"
                    : "var(--danger-medium)";
                return (
                  <tr
                    key={pos.id}
                    style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-m" style={{ fontWeight: 600 }}>{pos.ticker}</Text>
                      <Text variant="body-default-xs" onBackground="neutral-weak">
                        {TYPE_LABELS[pos.type as PositionType] || pos.type}
                      </Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-s" onBackground="neutral-weak">
                        {TYPE_LABELS[pos.type as PositionType] || pos.type}
                      </Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-m">${pos.buyPrice.toFixed(2)}</Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-m">
                        {savings && pos.expiresAt ? formatDate(pos.expiresAt) : "—"}
                      </Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {savings && pos.conditions ? (
                        <Text variant="body-default-xs" onBackground="neutral-weak">
                          {pos.conditions}
                        </Text>
                      ) : (
                        <Text variant="body-default-m">—</Text>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Text variant="body-default-m">
                        {pos.currentPrice !== null ? `$${pos.currentPrice.toFixed(2)}` : "—"}
                      </Text>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {savings ? (
                        pos.yieldRate !== undefined && pos.yieldRate !== null ? (
                          <Text variant="body-default-m" style={{ color: "var(--success-medium)", fontWeight: 600 }}>
                            {Number(pos.yieldRate).toFixed(2)}%
                          </Text>
                        ) : (
                          <Text variant="body-default-s" onBackground="neutral-weak">—</Text>
                        )
                      ) : (
                        <Column gap="xs">
                          <Text variant="body-default-m" style={{ color: pnlColor, fontWeight: 600 }}>
                            {pos.pnl !== null
                              ? `${pos.pnl >= 0 ? "+" : ""}$${pos.pnl.toFixed(2)}`
                              : "—"}
                          </Text>
                          {pos.pnlPercent !== null && (
                            <Text variant="body-default-xs" style={{ color: pnlColor }}>
                              ({pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%)
                            </Text>
                          )}
                        </Column>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Flex gap="s" vertical="center">
                        <Button size="s" variant="secondary" onClick={() => onEdit(pos)}>
                          Editar
                        </Button>
                        {!savings && (
                          <Button size="s" variant="secondary" onClick={() => onSell(pos)}>
                            Vender
                          </Button>
                        )}
                        <IconButton
                          icon="trash"
                          size="s"
                          variant="danger"
                          onClick={() => onDelete(pos.id)}
                          tooltip="Eliminar"
                        />
                      </Flex>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Flex>
    </Column>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: "12px 16px",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
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
