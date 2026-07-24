"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, Skeleton, IconButton } from "@once-ui-system/core";
import { NewsCard } from "@/components/news/NewsCard";
import type { NewsArticle } from "@/lib/news";

type TabType = "market" | "ticker";

export default function NewsPage() {
  const [chatId, setChatId] = useState("");
  const [tab, setTab] = useState<TabType>("market");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("quartly_chatId") || "default";
    setChatId(stored);
  }, []);

  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    const params = new URLSearchParams({ chatId });
    if (tab === "ticker" && selectedTicker) {
      params.set("ticker", selectedTicker);
    }

    fetch(`/api/dashboard/news?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setArticles((data.articles || []).slice(0, 30));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatId, tab, selectedTicker]);

  useEffect(() => {
    if (!chatId) return;
    fetch(`/api/dashboard/favorites?chatId=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const all = [
            ...(data.stocks || []).map((s: { ticker: string }) => s.ticker),
            ...(data.etfs || []).map((e: { ticker: string }) => e.ticker),
          ];
          setTickers(all);
        }
      })
      .catch(() => {});
  }, [chatId]);

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Noticias</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Noticias financieras y de mercado
        </Text>
      </Column>

      <Row gap="s" fillWidth>
        <button
          onClick={() => { setTab("market"); setSelectedTicker(null); }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid",
            borderColor: tab === "market" ? "var(--brand-strong)" : "var(--neutral-alpha-medium)",
            background: tab === "market" ? "var(--brand-alpha-weak)" : "transparent",
            color: tab === "market" ? "var(--brand-on-background-strong)" : "var(--neutral-on-background-weak)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          🌐 Mercado
        </button>
        <button
          onClick={() => setTab("ticker")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid",
            borderColor: tab === "ticker" ? "var(--brand-strong)" : "var(--neutral-alpha-medium)",
            background: tab === "ticker" ? "var(--brand-alpha-weak)" : "transparent",
            color: tab === "ticker" ? "var(--brand-on-background-strong)" : "var(--neutral-on-background-weak)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          📊 Mis Tickers
        </button>
      </Row>

      {tab === "ticker" && (
        <Row gap="s" fillWidth style={{ overflowX: "auto", flexWrap: "nowrap" }}>
          {tickers.length === 0 && (
            <Text variant="body-default-s" onBackground="neutral-weak">
              Agrega tickers a tu watchlist para ver sus noticias
            </Text>
          )}
          {tickers.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTicker(t)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: selectedTicker === t ? "var(--brand-strong)" : "var(--neutral-alpha-medium)",
                background: selectedTicker === t ? "var(--brand-alpha-weak)" : "transparent",
                color: selectedTicker === t ? "var(--brand-on-background-strong)" : "var(--neutral-on-background-weak)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {t}
            </button>
          ))}
        </Row>
      )}

      {loading ? (
        <Column gap="m" fillWidth>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} shape="block" height="l" fillWidth radius="m" />
          ))}
        </Column>
      ) : articles.length === 0 ? (
        <Column fillWidth horizontal="center" padding="xl" gap="m">
          <Text variant="body-default-m" onBackground="neutral-weak">
            {tab === "ticker" && !selectedTicker
              ? "Selecciona un ticker para ver sus noticias"
              : "No hay noticias disponibles. Verifica tu API key de NewsAPI."}
          </Text>
        </Column>
      ) : (
        <Column gap="m" fillWidth>
          {articles.map((article, i) => (
            <NewsCard key={`${article.url}-${i}`} article={article} />
          ))}
        </Column>
      )}
    </Column>
  );
}
