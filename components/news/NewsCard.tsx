/*
 * Quartly Bot — components/news/NewsCard.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { Column, Row, Text, Button } from "@once-ui-system/core";
import type { NewsArticle } from "@/lib/news";

export function NewsCard({ article }: { article: NewsArticle }) {
  const dateStr = new Date(article.publishedAt).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timeStr = new Date(article.publishedAt).toLocaleTimeString("es-MX", {
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
      {article.urlToImage && (
        <div
          style={{
            width: "100%",
            height: 200,
            backgroundImage: `url(${article.urlToImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "var(--neutral-alpha-weak)",
          }}
        />
      )}
      <Column padding="m" gap="s">
        <Row gap="s" vertical="center" wrap>
          <Text variant="label-default-xs" onBackground="neutral-weak">
            {article.source.name}
          </Text>
          <Text variant="label-default-xs" onBackground="neutral-weak">
            {dateStr} • {timeStr}
          </Text>
        </Row>
        <Text variant="label-strong-s">{article.title}</Text>
        {article.description && (
          <Text variant="body-default-s" onBackground="neutral-weak">
            {article.description.length > 200
              ? article.description.slice(0, 200) + "..."
              : article.description}
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
