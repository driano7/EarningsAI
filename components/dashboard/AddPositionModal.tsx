/*
 * Quartly Bot — components/dashboard/AddPositionModal.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect } from "react";
import { Column, Flex, Text, Button, Input, Heading } from "@once-ui-system/core";
import { Row } from "@once-ui-system/core";
import { motion, AnimatePresence } from "framer-motion";
import type { PortfolioPosition } from "@/lib/types";

interface AddPositionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (position: Partial<PortfolioPosition>) => void;
  editPosition?: PortfolioPosition | null;
  asSell?: boolean;
  onSell?: (data: { price: number; quantity: number; date: string }) => void;
}

export default function AddPositionModal({
  open,
  onClose,
  onSave,
  editPosition,
  asSell,
  onSell,
}: AddPositionModalProps) {
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<string>("stock");
  const [buyPrice, setBuyPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [yieldRate, setYieldRate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [conditions, setConditions] = useState("");

  const [sellPrice, setSellPrice] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");
  const [sellDate, setSellDate] = useState(new Date().toISOString().split("T")[0]);

  const isSavings = type === "sofipo" || type === "cetes";

  useEffect(() => {
    if (editPosition) {
      if (asSell) {
        setSellQuantity(String(editPosition.quantity));
        setSellPrice("");
      } else {
        setTicker(editPosition.ticker);
        setType(editPosition.type);
        setBuyPrice(String(editPosition.buyPrice));
        setQuantity(String(editPosition.quantity));
        setBuyDate(editPosition.buyDate.split("T")[0]);
        setNotes(editPosition.notes || "");
        setYieldRate(editPosition.yieldRate !== undefined && editPosition.yieldRate !== null ? String(editPosition.yieldRate) : "");
        setExpiresAt(editPosition.expiresAt || "");
        setConditions(editPosition.conditions || "");
      }
    } else {
      setTicker("");
      setType("stock");
      setBuyPrice("");
      setQuantity("");
      setBuyDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setYieldRate("");
      setExpiresAt("");
      setConditions("");
    }
  }, [editPosition, asSell, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (asSell && onSell) {
      onSell({
        price: Number(sellPrice),
        quantity: Number(sellQuantity),
        date: sellDate,
      });
      return;
    }

    onSave({
      ticker: ticker.toUpperCase(),
      type: type as "stock" | "etf" | "crypto" | "sofipo" | "cetes",
      buyPrice: Number(buyPrice),
      quantity: isSavings ? 1 : Number(quantity),
      buyDate,
      notes,
      yieldRate: yieldRate !== "" ? Number(yieldRate) : undefined,
      expiresAt: expiresAt || undefined,
      conditions: conditions || undefined,
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{
              width: "100%",
              maxWidth: 480,
              margin: 16,
            }}
          >
            <Column
              as="form"
              onSubmit={handleSubmit}
              padding="xl"
              gap="l"
              radius="m"
              className="liquid-glass"
              style={{
                background: "var(--neutral-surface)",
                border: "1px solid var(--neutral-alpha-medium)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
            >
              <Column gap="s">
                <Heading variant="heading-strong-m">
                  {asSell ? "Registrar Venta" : editPosition ? "Editar Posición" : "Agregar Posición"}
                </Heading>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {asSell && editPosition
                    ? `Vender ${editPosition.ticker}`
                    : "Completa los detalles de la posición"}
                </Text>
              </Column>

              {!asSell && (
                <Column gap="l">
                  <Flex gap="m">
                    <Input
                      id="pos-ticker"
                      label="Nombre / Ticker"
                      value={ticker}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTicker(e.target.value.toUpperCase())}
                      placeholder={
                        type === "sofipo" ? "Ej: FONDEO, KLAR" :
                        type === "cetes" ? "Ej: CETES28, CETES91" :
                        "Ej: AAPL"
                      }
                      disabled={!!editPosition}
                      style={{ flex: 1 }}
                    />
                    <Column gap="xs" style={{ flex: 1 }}>
                      <Text variant="body-default-xs" onBackground="neutral-weak">Tipo</Text>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="liquid-select"
                        style={{
                          width: "100%",
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
                        <option value="stock">Acción</option>
                        <option value="etf">ETF</option>
                        <option value="crypto">Cripto</option>
                        <option value="sofipo">🏦 SOFIPO</option>
                        <option value="cetes">📜 CETES</option>
                      </select>
                    </Column>
                  </Flex>
                  <Flex gap="m">
                    <Input
                      id="pos-buy-price"
                      label="Precio de compra ($)"
                      type="number"
                      step="0.01"
                      value={buyPrice}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBuyPrice(e.target.value)}
                      placeholder="0.00"
                      style={{ flex: 1 }}
                    />
                    {!isSavings && (
                      <Input
                        id="pos-quantity"
                        label="Cantidad"
                        type="number"
                        step="0.01"
                        value={quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                        placeholder="0"
                        style={{ flex: 1 }}
                      />
                    )}
                  </Flex>
                  {isSavings && (
                    <Column gap="m">
                      <Row gap="m">
                        <Input
                          id="pos-yield-rate"
                          label="Rendimiento anual (%)"
                          type="number"
                          step="0.01"
                          value={yieldRate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYieldRate(e.target.value)}
                          placeholder="Ej: 12.5"
                          style={{ flex: 1 }}
                        />
                        <Input
                          id="pos-expires-at"
                          label="Vencimiento"
                          type="date"
                          value={expiresAt}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value)}
                          style={{ flex: 1 }}
                        />
                      </Row>
                      <Input
                        id="pos-conditions"
                        label="Condiciones (opcional)"
                        value={conditions}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConditions(e.target.value)}
                        placeholder="Ej: Monto lim. $150k, retiros diarios 10%..."
                      />
                    </Column>
                  )}
                  <Input
                    id="pos-buy-date"
                    label="Fecha de compra"
                    type="date"
                    value={buyDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBuyDate(e.target.value)}
                  />
                  <Input
                    id="pos-notes"
                    label="Notas (opcional)"
                    value={notes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                    placeholder="Notas sobre la posición..."
                  />
                </Column>
              )}

              {asSell && editPosition && (
                <Column gap="l">
                  <Flex gap="m">
                    <Input
                      id="sell-price"
                      label="Precio de venta ($)"
                      type="number"
                      step="0.01"
                      value={sellPrice}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSellPrice(e.target.value)}
                      placeholder="0.00"
                      style={{ flex: 1 }}
                    />
                    <Input
                      id="sell-quantity"
                      label="Cantidad a vender"
                      type="number"
                      step="0.01"
                      value={sellQuantity}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSellQuantity(e.target.value)}
                      placeholder="0"
                      style={{ flex: 1 }}
                    />
                  </Flex>
                  <Input
                    id="sell-date"
                    label="Fecha de venta"
                    type="date"
                    value={sellDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSellDate(e.target.value)}
                  />
                </Column>
              )}

              <Flex gap="m" horizontal="end">
                <Button variant="secondary" type="button" onClick={onClose}>
                  Cancelar
                </Button>
                <Button variant="primary" type="submit">
                  {asSell ? "Registrar Venta" : editPosition ? "Guardar Cambios" : "Agregar"}
                </Button>
              </Flex>
            </Column>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
