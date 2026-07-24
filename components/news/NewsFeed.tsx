/*
 * Quartly Bot — components/news/NewsFeed.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect } from "react";
import { Column, Text, Skeleton } from "@once-ui-system/core";
import { NewsCard } from "./NewsCard";
import type { NewsArticle } from "@/lib/news";

interface Props {
  chatId: string;
  ticker?: string;
}

export function NewsFeed({ chatId, ticker }: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ chatId });
    if (ticker) params.set("ticker", ticker);

    fetch(`/api/dashboard/news?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setArticles(data.articles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatId, ticker]);

  if (loading) {
    return (
      <Column gap="m" fillWidth>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} shape="block" height="l" fillWidth radius="m" />
        ))}
      </Column>
    );
  }

  if (articles.length === 0) {
    return (
      <Column fillWidth horizontal="center" padding="l">
        <Text variant="body-default-m" onBackground="neutral-weak">
          No hay noticias disponibles
        </Text>
      </Column>
    );
  }

  return (
    <Column gap="m" fillWidth>
      {articles.map((article, i) => (
        <NewsCard key={`${article.url}-${i}`} article={article} />
      ))}
    </Column>
  );
}
