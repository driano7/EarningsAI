/*
 * Quartly Bot — components/news/FinnhubNewsCard.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { Column, Row, Text, Button } from "@once-ui-system/core";
import type { FinnhubNews } from "@/lib/finnhub";

export function FinnhubNewsCard({ article }: { article: FinnhubNews }) {
  const dateStr = new Date(article.datetime * 1000).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timeStr = new Date(article.datetime * 1000).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Column
      fillWidth
      radius="m"
      className="glass-card"
      style={{
        border: "1px solid var(--neutral-alpha-weak)",
        overflow: "hidden",
      }}
    >
      {article.image && (
        <div
          style={{
            width: "100%",
            height: 180,
            backgroundImage: `url(${article.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "var(--neutral-alpha-weak)",
          }}
        />
      )}
      <Column padding="m" gap="s">
        <Row gap="s" vertical="center" wrap>
          <Text variant="label-default-xs" onBackground="neutral-weak">
            {article.source}
          </Text>
          <Text variant="label-default-xs" onBackground="neutral-weak">
            {dateStr} • {timeStr}
          </Text>
          {article.category && (
            <Text variant="label-default-xs" onBackground="brand-weak">
              {article.category}
            </Text>
          )}
        </Row>
        <Text variant="label-strong-s">{article.headline}</Text>
        {article.summary && (
          <Text variant="body-default-s" onBackground="neutral-weak">
            {article.summary.length > 200
              ? article.summary.slice(0, 200) + "..."
              : article.summary}
          </Text>
        )}
        <Button
          size="s"
          variant="tertiary"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Leer nota completa →
        </Button>
      </Column>
    </Column>
  );
}
