"use client";

import { Column, Row, Text, Button } from "@once-ui-system/core";
import type { NewsArticle } from "@/lib/news";

export function NewsCard({ article }: { article: NewsArticle }) {
  const dateStr = new Date(article.publishedAt).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Column
      fillWidth
      padding="m"
      radius="m"
      style={{
        border: "1px solid var(--neutral-alpha-weak)",
      }}
      gap="s"
    >
      <Row gap="s" vertical="center" wrap>
        <Text variant="label-default-xs" onBackground="neutral-weak">
          {article.source.name}
        </Text>
        <Text variant="label-default-xs" onBackground="neutral-weak">
          {dateStr}
        </Text>
      </Row>
      <Text variant="label-strong-s">{article.title}</Text>
      {article.description && (
        <Text variant="body-default-s" onBackground="neutral-weak">
          {article.description}
        </Text>
      )}
      <Button
        size="s"
        variant="tertiary"
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Leer más
      </Button>
    </Column>
  );
}
