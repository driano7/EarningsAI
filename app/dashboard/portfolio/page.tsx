/*
 * Quartly Bot — app/dashboard/portfolio/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Column, Row, Flex, Heading, Text, Button, Grid, Card, Badge } from "@once-ui-system/core";
import PortfolioTable from "@/components/dashboard/PortfolioTable";
import AddPositionModal from "@/components/dashboard/AddPositionModal";
import type { PortfolioPosition } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/formatFinance";

export default function PortfolioPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPos, setEditPos] = useState<PortfolioPosition | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSell, setShowSell] = useState(false);

  const chatId = typeof window !== "undefined" ? localStorage.getItem("quartly_chatId") || "default" : "default";

  interface PositionPrice { ticker: string; currentPrice: number | null; }
  const [positionPrices, setPositionPrices] = useState<PositionPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [audit, setAudit] = useState<any[]>([]);
  const refreshAudit = useCallback(async () => {
    try { const r = await fetch(`/api/dashboard/audit/history?chatId=${chatId}`); const j = await r.json(); if (j.ok) setAudit(j.history); } catch {}
  }, [chatId]);
  useEffect(() => { refreshAudit(); const id = setInterval(refreshAudit, 30000); return () => clearInterval(id); }, [refreshAudit]);
  useEffect(() => { refreshAudit(); }, [positions.length]);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/portfolio?chatId=${chatId}`);
      const json = await res.json();
      if (json.ok) setPositions(json.positions);
    } catch { /* ignore */ }
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  useEffect(() => {
    if (positions.length === 0) { setPositionPrices([]); return; }
    setPricesLoading(true);
    Promise.all(
      positions.map(async (pos) => {
        try {
          const res = await fetch(`/api/finance/price?ticker=${pos.ticker}`);
          const json = await res.json();
          return { ticker: pos.ticker, currentPrice: json.ok ? json.data.current : null };
        } catch {
          return { ticker: pos.ticker, currentPrice: null };
        }
      })
    ).then((results) => {
      setPositionPrices(results);
      setPricesLoading(false);
    });
  }, [positions]);

  const portfolioAnalytics = useMemo(() => {
    if (positions.length === 0 || positionPrices.length === 0) return null;

    const totalInvested = positions.reduce((s, p) => s + p.buyPrice * p.quantity, 0);
    const totalValue = positions.reduce((s, p) => {
      const price = positionPrices.find((pp) => pp.ticker === p.ticker)?.currentPrice;
      return s + (price ?? p.buyPrice) * p.quantity;
    }, 0);
    const pnl = totalValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

    const weights = positions.map((p) => {
      const price = positionPrices.find((pp) => pp.ticker === p.ticker)?.currentPrice ?? p.buyPrice;
      return (price * p.quantity) / totalValue;
    });
    const hhi = weights.reduce((s, w) => s + w * w, 0);

    const withReturns = positions.map((p) => {
      const cp = positionPrices.find((pp) => pp.ticker === p.ticker)?.currentPrice;
      const ret = cp ? ((cp - p.buyPrice) / p.buyPrice) * 100 : null;
      return { ...p, currentPrice: cp, return: ret };
    });

    const sorted = [...withReturns].filter((p) => p.return !== null).sort((a, b) => (b.return ?? 0) - (a.return ?? 0));
    const best = sorted[0] ?? null;
    const worst = sorted[sorted.length - 1] ?? null;

    return {
      totalInvested, totalValue, pnl, pnlPercent,
      positionsCount: positions.length,
      hhi,
      bestTicker: best?.ticker ?? null,
      bestReturn: best?.return ?? null,
      worstTicker: worst?.ticker ?? null,
      worstReturn: worst?.return ?? null,
    };
  }, [positions, positionPrices]);

  async function handleSave(pos: Partial<PortfolioPosition>) {
    try {
      if (editPos) {
        await fetch(`/api/dashboard/portfolio?chatId=${chatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editPos.id, ...pos }),
        });
      } else {
        await fetch(`/api/dashboard/portfolio?chatId=${chatId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pos),
        });
      }
      setShowModal(false);
      setEditPos(null);
      fetchPositions();
      refreshAudit();
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/dashboard/portfolio?chatId=${chatId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchPositions();
      refreshAudit();
    } catch { /* ignore */ }
  }

  async function handleSellData(data: { price: number; quantity: number; date: string }) {
    if (!editPos) return;
    try {
      await fetch(`/api/dashboard/transactions?chatId=${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: editPos.ticker,
          type: "sell",
          price: data.price,
          quantity: data.quantity,
          date: data.date,
          notes: `Venta parcial de posición ${editPos.id}`,
        }),
      });

      const remaining = editPos.quantity - data.quantity;
      if (remaining <= 0) {
        await handleDelete(editPos.id);
      } else {
        await fetch(`/api/dashboard/portfolio?chatId=${chatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editPos.id, quantity: remaining }),
        });
      }

      setShowSell(false);
      setEditPos(null);
      fetchPositions();
      refreshAudit();
    } catch { /* ignore */ }
  }

  function openAdd() {
    setEditPos(null);
    setShowModal(true);
  }

  function openEdit(pos: PortfolioPosition) {
    setEditPos(pos);
    setShowModal(true);
  }

  function openSell(pos: PortfolioPosition) {
    setEditPos(pos);
    setShowSell(true);
  }

  if (loading) {
    return <Text>Cargando...</Text>;
  }

  return (
    <Column gap="l">
      <Row vertical="center" horizontal="between" wrap gap="m">
        <Column gap="s">
          <Heading variant="heading-strong-xl">Portfolio</Heading>
          <Text variant="body-default-l" onBackground="neutral-weak">
            Gestiona tus posiciones de inversión
          </Text>
        </Column>
        <Button variant="primary" onClick={openAdd}>
          + Agregar Posición
        </Button>
      </Row>

      <PortfolioTable
        positions={positions}
        onEdit={openEdit}
        onDelete={handleDelete}
        onSell={openSell}
        onRefresh={fetchPositions}
      />

      {portfolioAnalytics && (
        <Column gap="m">
          <Row vertical="center" gap="m">
            <Heading variant="heading-strong-m">Analítica del Portafolio</Heading>
            {pricesLoading && <Text variant="body-default-s" onBackground="neutral-weak">Cargando...</Text>}
          </Row>
          <Grid columns="4" gap="m" l={{ columns: 2 }} s={{ columns: 2 }}>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Valor Total</Text>
              <Text variant="label-strong-m">{formatCurrency(portfolioAnalytics.totalValue)}</Text>
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Invertido</Text>
              <Text variant="label-strong-m">{formatCurrency(portfolioAnalytics.totalInvested)}</Text>
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">P&L Total</Text>
              <Text variant="label-strong-m" onBackground={portfolioAnalytics.pnl >= 0 ? "success-medium" : "danger-medium"}>
                {portfolioAnalytics.pnl >= 0 ? "+" : ""}{formatCurrency(portfolioAnalytics.pnl)}
                {" "}({formatPercent(portfolioAnalytics.pnlPercent)})
              </Text>
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Posiciones</Text>
              <Text variant="label-strong-m">{portfolioAnalytics.positionsCount}</Text>
            </Column>
          </Grid>
          <Grid columns="4" gap="m" l={{ columns: 2 }} s={{ columns: 2 }}>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Concentración</Text>
              <Text variant="label-strong-m">
                {portfolioAnalytics.hhi > 0.5 ? "🔴 Alta" : portfolioAnalytics.hhi > 0.25 ? "🟡 Media" : "🟢 Baja"}
              </Text>
              <Text variant="label-default-xs" onBackground="neutral-weak">HHI: {portfolioAnalytics.hhi.toFixed(2)}</Text>
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Mejor posición</Text>
              {portfolioAnalytics.bestTicker ? (
                <>
                  <Text variant="label-strong-m" onBackground="success-medium">{portfolioAnalytics.bestTicker}</Text>
                  <Text variant="label-default-xs" onBackground="success-medium">{formatPercent(portfolioAnalytics.bestReturn ?? 0)}</Text>
                </>
              ) : (
                <Text variant="label-strong-m">—</Text>
              )}
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Peor posición</Text>
              {portfolioAnalytics.worstTicker ? (
                <>
                  <Text variant="label-strong-m" onBackground="danger-medium">{portfolioAnalytics.worstTicker}</Text>
                  <Text variant="label-default-xs" onBackground="danger-medium">{formatPercent(portfolioAnalytics.worstReturn ?? 0)}</Text>
                </>
              ) : (
                <Text variant="label-strong-m">—</Text>
              )}
            </Column>
          </Grid>
        </Column>
      )}

      {/* ── Audit History (siempre visible, append-only) ── */}
      <Column gap="s" style={{ marginTop: 8 }}>
        <Row vertical="center" horizontal="between">
          <Heading variant="heading-strong-m">Historial de Auditoría — Cambios</Heading>
          <Text variant="label-default-xs" onBackground="neutral-weak">{audit.length} registros · nunca se eliminan</Text>
        </Row>
        <Card padding="s" radius="m" fillWidth>
          <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--neutral-background)", zIndex: 1 }}>
                <tr style={{ borderBottom: "1px solid var(--neutral-alpha-medium)" }}>
                  {["Fecha y hora", "Cambio / Dónde", "Método", "SO / Navegador"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "var(--neutral-on-background-weak)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: "16px", textAlign: "center", color: "var(--neutral-on-background-weak)" }}>Sin auditoría aún — aquí verás cada cambio manual o del chatbot con SO/navegador, y nunca se borrará.</td></tr>
                ) : audit.slice(0, 200).map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{a.dateTime}<br/><span style={{ color:"var(--neutral-on-background-weak)", fontSize:"0.72rem"}}>{a.timestamp.slice(0,10)}</span></td>
                    <td style={{ padding: "8px 10px", maxWidth: 320 }}><span style={{ fontWeight:600 }}>{a.change}</span><br/><span style={{ color:"var(--neutral-on-background-weak)" }}>{a.where}</span></td>
                    <td style={{ padding: "8px 10px" }}><Badge textVariant="label-default-xs" color={a.method==="chatbot"?"brand":"neutral"}>{a.method==="chatbot"?"🤖 chatbot":"👤 manual"}</Badge></td>
                    <td style={{ padding: "8px 10px", whiteSpace:"nowrap" }}>{a.os} / {a.browser}<br/><span style={{ color:"var(--neutral-on-background-weak)", fontSize:"0.7rem"}} title={a.userAgent}>{a.userAgent.slice(0,60)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Column>

      <AddPositionModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditPos(null); }}
        onSave={handleSave}
        editPosition={editPos}
      />

      <AddPositionModal
        open={showSell}
        onClose={() => { setShowSell(false); setEditPos(null); }}
        onSave={() => {}}
        editPosition={editPos}
        asSell
        onSell={handleSellData}
      />
    </Column>
  );
}
