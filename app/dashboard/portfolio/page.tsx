/*
 * Quartly Bot — app/dashboard/portfolio/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Column, Row, Flex, Heading, Text, Button } from "@once-ui-system/core";
import PortfolioTable from "@/components/dashboard/PortfolioTable";
import AddPositionModal from "@/components/dashboard/AddPositionModal";
import type { PortfolioPosition } from "@/lib/types";

export default function PortfolioPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPos, setEditPos] = useState<PortfolioPosition | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSell, setShowSell] = useState(false);

  const chatId = typeof window !== "undefined" ? localStorage.getItem("quartly_chatId") || "default" : "default";

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
