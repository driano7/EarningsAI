"use client";

import { Column, Row, Text, IconButton, Badge } from "@once-ui-system/core";
import { useState, useEffect } from "react";
import { DailySummaryCard } from "./DailySummaryCard";

interface SummaryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

interface SummaryEntry {
  date: string;
  content: string;
  createdAt: number;
}

export function SummaryHistoryModal({ isOpen, onClose, chatId }: SummaryHistoryModalProps) {
  const [history, setHistory] = useState<SummaryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !chatId) return;

    setLoading(true);
    fetch(`/api/dashboard/news/history?chatId=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setHistory(data.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, chatId]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.88)",
        }}
        onClick={onClose}
      />

      <Column
        radius="l"
        fillWidth
        style={{
          position: "relative",
          maxWidth: 520,
          maxHeight: "80vh",
          background: "var(--neutral-background)",
          border: "1px solid var(--neutral-alpha-medium)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Row
          fillWidth
          horizontal="between"
          vertical="center"
          padding="l"
          style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}
        >
          <Column gap="xs">
            <Text variant="heading-strong-m">Supernotas</Text>
            <Text variant="label-default-xs" onBackground="neutral-weak">
              Resumenes diarios de los ultimos 30 dias
            </Text>
          </Column>
          <Row gap="s" vertical="center">
            <Badge
              background="neutral-alpha-weak"
              onBackground="neutral-weak"
              paddingX="s"
              paddingY="xs"
            >
              <Text variant="label-default-xs">{history.length}</Text>
            </Badge>
            <IconButton
              icon="close"
              onClick={onClose}
              size="s"
              variant="tertiary"
            />
          </Row>
        </Row>

        <Column
          padding="l"
          gap="m"
          style={{
            overflowY: "auto",
            flex: 1,
          }}
        >
          {loading ? (
            <Column gap="s" padding="l" horizontal="center">
              <Text variant="body-default-s" onBackground="neutral-weak">
                Cargando historial...
              </Text>
            </Column>
          ) : history.length === 0 ? (
            <Column gap="s" padding="xl" horizontal="center">
              <Text variant="body-default-m" onBackground="neutral-weak">
                No hay supernotas guardadas
              </Text>
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Se generan automaticamente cada dia a las 8 AM
              </Text>
            </Column>
          ) : (
            history.map((summary, i) => (
              <DailySummaryCard
                key={summary.date}
                date={summary.date}
                content={summary.content}
                createdAt={summary.createdAt}
                isLatest={i === 0}
              />
            ))
          )}
        </Column>
      </Column>
    </div>
  );
}
