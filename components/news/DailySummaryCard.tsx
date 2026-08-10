/*
 * Quartly Bot — components/news/DailySummaryCard.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { Column, Row, Text, Badge, IconButton } from "@once-ui-system/core";
import { useState } from "react";
import { HighlightedText } from "./HighlightedText";

interface DailySummaryCardProps {
  date: string;
  content: string;
  createdAt: number;
  isLatest?: boolean;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function parseSections(content: string): Array<{ title: string; body: string }> {
  const lines = content.split("\n");
  const sections: Array<{ title: string; body: string }> = [];
  let current = { title: "", body: "" };

  for (const line of lines) {
    const trimmed = line.trim();
    const isSectionHeader =
      trimmed.startsWith("SUPERNOTA") ||
      trimmed.startsWith("PORTAFOLIO") ||
      trimmed.startsWith("MACRO") ||
      trimmed.startsWith("SENALES") ||
      trimmed.startsWith("CATALIZADORES") ||
      trimmed.startsWith("CIERRE") ||
      trimmed.startsWith("MERCADO") ||
      (trimmed.endsWith(":") && trimmed.length < 40 && trimmed === trimmed.toUpperCase() && trimmed.length > 3);

    if (isSectionHeader) {
      if (current.title || current.body) {
        sections.push({ ...current });
      }
      current = { title: trimmed.replace(/:$/, ""), body: "" };
    } else if (trimmed) {
      current.body += (current.body ? "\n" : "") + trimmed;
    }
  }

  if (current.title || current.body) {
    sections.push(current);
  }

  return sections;
}

export function DailySummaryCard({ date, content, createdAt, isLatest }: DailySummaryCardProps) {
  const [expanded, setExpanded] = useState(isLatest);
  const sections = parseSections(content);
  const hasMore = content.length > 300;

  return (
    <Column
      padding="l"
      radius="l"
      gap="s"
      fillWidth
      className="liquid-glass-sm"
      style={{
        border: isLatest ? "1px solid var(--brand-alpha-medium)" : "1px solid var(--neutral-alpha-weak)",
      }}
    >
      <Row fillWidth horizontal="between" vertical="center">
        <Row gap="s" vertical="center">
          <Badge
            background={isLatest ? "brand-alpha-weak" : "neutral-alpha-weak"}
            onBackground={isLatest ? "brand-medium" : "neutral-weak"}
            paddingX="s"
            paddingY="xs"
          >
            <Text variant="label-default-xs">
              {isLatest ? "HOY" : formatDateDisplay(date)}
            </Text>
          </Badge>
          <Text variant="label-default-xs" onBackground="neutral-weak">
            {getTimeAgo(createdAt)}
          </Text>
        </Row>
        {hasMore && (
          <IconButton
            icon={expanded ? "chevronUp" : "chevronDown"}
            onClick={() => setExpanded(!expanded)}
            size="s"
            variant="tertiary"
          />
        )}
      </Row>

      <Column
        gap="s"
        fillWidth
        style={{
          maxHeight: expanded ? "none" : "120px",
          overflow: expanded ? "visible" : "hidden",
          maskImage: expanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)",
          WebkitMaskImage: expanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)",
        }}
      >
        {sections.length > 0
          ? sections.map((section, i) => (
              <Column key={i} gap="xs" fillWidth>
                {section.title && (
                  <Text
                    variant="label-default-s"
                    onBackground="brand-medium"
                    style={
                      /(SEM|VERED|CONCLUS|CATALIZ|CIERRE)/i.test(section.title)
                        ? { textDecoration: "underline" }
                        : undefined
                    }
                  >
                    {section.title}
                  </Text>
                )}
                <HighlightedText
                  text={section.body}
                  style={{
                    fontSize: "var(--font-size-body-s)",
                    color: "var(--neutral-on-background-weak)",
                  }}
                />
              </Column>
            ))
          : (
              <HighlightedText
                text={content}
                style={{
                  fontSize: "var(--font-size-body-s)",
                  color: "var(--neutral-on-background-weak)",
                }}
              />
            )}
      </Column>

      {!expanded && hasMore && (
        <Text
          variant="label-default-xs"
          onBackground="brand-medium"
          style={{ cursor: "pointer" }}
          onClick={() => setExpanded(true)}
        >
          Ver completo...
        </Text>
      )}
    </Column>
  );
}
