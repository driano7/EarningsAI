/*
 * Quartly Bot — components/news/SummaryHistoryModal.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { Column, Row, Text, IconButton, Badge } from "@once-ui-system/core";
import { useState, useEffect } from "react";

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

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "hace un momento";
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function getPreview(content: string, maxLength = 120): string {
  const clean = content.replace(/SUPERNOTA.*?\n/, "").replace(/\n+/g, " ").trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) + "..." : clean;
}

interface SummaryEntry {
  date: string;
  content: string;
  createdAt: number;
}

export function SummaryHistoryModal({ isOpen, onClose, chatId }: SummaryHistoryModalProps) {
  const [history, setHistory] = useState<SummaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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
        className="liquid-glass"
        style={{
          position: "relative",
          maxWidth: 520,
          maxHeight: "85vh",
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
          gap="s"
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
            history.map((summary, i) => {
              const isExpanded = expandedDate === summary.date;
              return (
                <Card
                  key={summary.date}
                  padding={isExpanded ? "l" : "m"}
                  radius="m"
                  fillWidth
                  className="liquid-glass-sm"
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: isExpanded ? "1px solid var(--brand-medium)" : "1px solid var(--neutral-alpha-weak)",
                    background: isExpanded ? "var(--brand-alpha-weak)" : "transparent",
                  }}
                  onClick={() => setExpandedDate(isExpanded ? null : summary.date)}
                >
                  {!isExpanded ? (
                    <Row vertical="center" horizontal="between">
                      <Column gap="xs">
                        <Text variant="label-strong-s">{formatDateDisplay(summary.date)}</Text>
                        <Row gap="s" vertical="center">
                          <Badge
                            background="brand-alpha-weak"
                            onBackground="brand-medium"
                            paddingX="s"
                            paddingY="xs"
                          >
                            <Text variant="label-default-xs">{i === 0 ? "HOY" : formatTimeAgo(summary.createdAt)}</Text>
                          </Badge>
                        </Row>
                      </Column>
                      <IconButton
                        icon="chevronDown"
                        size="s"
                        variant="tertiary"
                        onClick={(e) => { e.stopPropagation(); setExpandedDate(summary.date); }}
                      />
                    </Row>
                  ) : (
                    <Column gap="m">
                      <Row vertical="center" horizontal="between">
                        <Column gap="xs">
                          <Text variant="label-strong-s">{formatDateDisplay(summary.date)}</Text>
                          <Text variant="label-default-xs" onBackground="neutral-weak">
                            {formatTimeAgo(summary.createdAt)}
                          </Text>
                        </Column>
                        <IconButton
                          icon="close"
                          size="s"
                          variant="tertiary"
                          onClick={(e) => { e.stopPropagation(); setExpandedDate(null); }}
                        />
                      </Row>
                      <Text
                        variant="body-default-s"
                        onBackground="neutral-weak"
                        style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                      >
                        {summary.content}
                      </Text>
                    </Column>
                  )}
                </Card>
              );
            })
          )}
        </Column>
      </Column>
    </div>
  );
}