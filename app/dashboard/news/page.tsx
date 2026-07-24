"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Skeleton, Badge, IconButton } from "@once-ui-system/core";
import { NewsCard } from "@/components/news/NewsCard";
import { FinnhubNewsCard } from "@/components/news/FinnhubNewsCard";
import { DailySummaryCard } from "@/components/news/DailySummaryCard";
import { SummaryHistoryModal } from "@/components/news/SummaryHistoryModal";
import type { NewsArticle } from "@/lib/news";
import type { FinnhubNews } from "@/lib/finnhub";

type TabType = "supernota" | "market" | "ticker" | "finnhub";
type NewsItem = (NewsArticle | FinnhubNews) & { _source: string };

interface SummaryEntry {
  date: string;
  content: string;
  createdAt: number;
}

export default function NewsPage() {
  const [chatId, setChatId] = useState("");
  const [tab, setTab] = useState<TabType>("supernota");
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [loadingTickers, setLoadingTickers] = useState(true);

  const [latestSummary, setLatestSummary] = useState<SummaryEntry | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("quartly_chatId") || "default";
    setChatId(stored);
  }, []);

  useEffect(() => {
    if (!chatId) return;
    setLoadingTickers(true);
    fetch(`/api/dashboard/favorites?chatId=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const all = [
            ...(data.stocks || []).map((s: { ticker: string }) => `📈 ${s.ticker}`),
            ...(data.etfs || []).map((e: { ticker: string }) => `📊 ${e.ticker}`),
            ...(data.cryptos || []).map((c: { ticker: string }) => `🪙 ${c.ticker}`),
          ];
          setTickers(all);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTickers(false));
  }, [chatId]);

  useEffect(() => {
    if (!chatId || tab !== "supernota") return;
    setSummaryLoading(true);
    fetch(`/api/dashboard/news/history?chatId=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.history?.length > 0) {
          setLatestSummary(data.history[0]);
        } else {
          setLatestSummary(null);
        }
      })
      .catch(() => setLatestSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [chatId, tab]);

  useEffect(() => {
    if (!chatId || tab === "supernota") return;
    setLoading(true);
    const params = new URLSearchParams({ chatId, source: tab === "finnhub" ? "finnhub" : "newsapi" });
    if (tab === "ticker" && selectedTicker) {
      const cleanTicker = selectedTicker.replace(/^[📈📊🪙]\s*/, "");
      params.set("ticker", cleanTicker);
    }

    fetch(`/api/dashboard/news?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const items = (data.articles || []).slice(0, 30).map((a: NewsArticle | FinnhubNews) => ({
            ...a,
            _source: data.source || "newsapi",
          }));
          setArticles(items);
        } else {
          setArticles([]);
        }
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [chatId, tab, selectedTicker]);

  return (
    <Column gap="l">
      <Row fillWidth horizontal="between" vertical="center">
        <Column gap="s">
          <Heading variant="heading-strong-xl">Noticias</Heading>
          <Text variant="body-default-l" onBackground="neutral-weak">
            Noticias de mercado, acciones, ETFs y cryptos
          </Text>
        </Column>
        <IconButton
          icon="history"
          onClick={() => setHistoryOpen(true)}
          size="m"
          variant="tertiary"
          tooltip="Historial de Supernotas"
        />
      </Row>

      <Row gap="s" fillWidth wrap>
        {([
          { key: "supernota", label: "📰 Supernota" },
          { key: "market", label: "🌐 Mercado" },
          { key: "ticker", label: "📊 Mis Favoritos" },
          { key: "finnhub", label: "📡 Finnhub" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedTicker(null); }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: tab === t.key ? "var(--brand-strong)" : "var(--neutral-alpha-medium)",
              background: tab === t.key ? "var(--brand-alpha-weak)" : "transparent",
              color: tab === t.key ? "var(--brand-on-background-strong)" : "var(--neutral-on-background-weak)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
      </Row>

      {tab === "supernota" && (
        <Column gap="m" fillWidth>
          {summaryLoading ? (
            <Skeleton shape="block" height="l" fillWidth radius="m" />
          ) : latestSummary ? (
            <DailySummaryCard
              date={latestSummary.date}
              content={latestSummary.content}
              createdAt={latestSummary.createdAt}
              isLatest
            />
          ) : (
            <Column fillWidth horizontal="center" padding="xl" gap="m">
              <Text variant="body-default-m" onBackground="neutral-weak">
                No hay supernota de hoy
              </Text>
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Se genera automaticamente cada dia a las 8 AM
              </Text>
            </Column>
          )}
        </Column>
      )}

      {tab === "ticker" && (
        <Column gap="s">
          {loadingTickers ? (
            <Row gap="s" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} shape="block" width="s" height="s" radius="s" />
              ))}
            </Row>
          ) : tickers.length === 0 ? (
            <Text variant="body-default-s" onBackground="neutral-weak">
              Agrega activos a tu watchlist desde Favoritos
            </Text>
          ) : (
            <Row gap="s" fillWidth style={{ overflowX: "auto", flexWrap: "nowrap" }}>
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
        </Column>
      )}

      {tab !== "supernota" && (
        loading ? (
          <Column gap="m" fillWidth>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} shape="block" height="l" fillWidth radius="m" />
            ))}
          </Column>
        ) : articles.length === 0 ? (
          <Column fillWidth horizontal="center" padding="xl" gap="m">
            <Text variant="body-default-m" onBackground="neutral-weak">
              {tab === "ticker" && !selectedTicker
                ? "Selecciona un activo para ver sus noticias"
                : "No hay noticias disponibles."}
            </Text>
          </Column>
        ) : (
          <Column gap="m" fillWidth>
            {articles.map((article, i) => {
              if (article._source === "finnhub") {
                const finnhubArticle = article as FinnhubNews & { _source: string };
                return <FinnhubNewsCard key={`finnhub-${finnhubArticle.id || i}`} article={finnhubArticle} />;
              }
              const newsApiArticle = article as NewsArticle & { _source: string };
              return <NewsCard key={`${newsApiArticle.url}-${i}`} article={newsApiArticle} />;
            })}
          </Column>
        )
      )}

      <SummaryHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        chatId={chatId}
      />
    </Column>
  );
}
