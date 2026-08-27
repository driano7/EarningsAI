/*
 * Quartly Bot — app/dashboard/news/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Skeleton, Badge, Icon, IconButton } from "@once-ui-system/core";
import { NewsCard } from "@/components/news/NewsCard";
import { FinnhubNewsCard } from "@/components/news/FinnhubNewsCard";
import { DailySummaryCard } from "@/components/news/DailySummaryCard";
import { SummaryHistoryModal } from "@/components/news/SummaryHistoryModal";
import { HighlightedText } from "@/components/news/HighlightedText";
import { Reveal } from "@/components/charts/Reveal";
import type { NewsArticle } from "@/lib/news";
import type { FinnhubNews } from "@/lib/finnhub";

type TabType = "supernota" | "superinvestors" | "market" | "ticker" | "finnhub" | "favai";
type NewsItem = (NewsArticle | FinnhubNews) & { _source: string; _ticker?: string };

interface SummaryEntry {
  date: string;
  content: string;
  createdAt: number;
}

interface FinnhubData {
  general: FinnhubNews[];
  favorites: (FinnhubNews & { _ticker: string })[];
}

interface FavGroup {
  ticker: string;
  name: string;
  type: "stock" | "etf" | "crypto";
  articles: NewsArticle[];
  analysis: string | null;
}

interface FavBundle {
  groups: FavGroup[];
  macro: Array<{ label: string; value: number | null; unit: string }>;
  generatedAt: number;
}

export default function NewsPage() {
  const [chatId, setChatId] = useState("");
  const [tab, setTab] = useState<TabType>("supernota");
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [finnhubData, setFinnhubData] = useState<FinnhubData | null>(null);
  const [favBundle, setFavBundle] = useState<FavBundle | null>(null);
  const [favLoading, setFavLoading] = useState(false);
  const [favRefresh, setFavRefresh] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [loadingTickers, setLoadingTickers] = useState(true);

  const [summaries, setSummaries] = useState<SummaryEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [superHistory, setSuperHistory] = useState<Record<string, any[]> | null>(null);
  const [superLoading, setSuperLoading] = useState(false);
  const [superData, setSuperData] = useState<any | null>(null);

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
          setSummaries(data.history.slice(0, 3));
        } else {
          setSummaries([]);
        }
      })
      .catch(() => setSummaries([]))
      .finally(() => setSummaryLoading(false));
  }, [chatId, tab]);

  useEffect(() => {
    if (tab !== "superinvestors") return;
    setSuperLoading(true);
    Promise.all([
      fetch(`/api/dashboard/superinversores`).then((r) => r.json()).catch(() => ({ ok: false })),
      fetch(`/api/dashboard/superinversores/history`).then((r) => r.json()).catch(() => ({ ok: false })),
    ]).then(([curr, hist]) => {
      if (curr?.ok) setSuperData(curr);
      if (hist?.ok) setSuperHistory(hist.history);
    }).finally(() => setSuperLoading(false));
  }, [tab]);

  useEffect(() => {
    if (!chatId || tab !== "favai") return;
    setFavLoading(true);
    fetch(`/api/dashboard/news/favorites?chatId=${chatId}${favRefresh ? "&refresh=1" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setFavBundle(data);
          setOpenGroups((prev) => {
            const next: Record<string, boolean> = {};
            data.groups.forEach((g: FavGroup, i: number) => {
              next[g.ticker] = prev?.[g.ticker] !== undefined ? prev[g.ticker] : i === 0;
            });
            return next;
          });
        }
      })
      .catch(() => setFavBundle(null))
      .finally(() => { setFavLoading(false); setFavRefresh(false); });
  }, [chatId, tab, favRefresh]);

  useEffect(() => {
    if (!chatId || tab === "supernota" || tab === "favai") return;
    setLoading(true);
    setFinnhubData(null);
    setArticles([]);

    if (tab === "finnhub") {
      const params = new URLSearchParams({ chatId, source: "finnhub" });
      fetch(`/api/dashboard/news?${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setFinnhubData({
              general: data.general || [],
              favorites: data.favorites || [],
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }

    const params = new URLSearchParams({ chatId, source: "newsapi" });
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

  const allOpen =
    !!favBundle && favBundle.groups.length > 0 && favBundle.groups.every((g) => Boolean(openGroups[g.ticker]));

  const toggleGroup = (ticker: string) =>
    setOpenGroups((prev) => ({ ...prev, [ticker]: !Boolean(prev[ticker]) }));

  const setAllGroups = (open: boolean) => {
    if (!favBundle) return;
    setOpenGroups(Object.fromEntries(favBundle.groups.map((g) => [g.ticker, open])));
  };

  return (
    <Column gap="l">
      <Row fillWidth horizontal="between" vertical="center">
        <Column gap="s">
          <Heading variant="heading-strong-xl">Noticias</Heading>
          <Text variant="body-default-l" onBackground="neutral-weak">
            Noticias de mercado, acciones, ETFs y cryptos
          </Text>
        </Column>
      </Row>

      <Row gap="s" fillWidth wrap>
        {([
          { key: "supernota", label: "📰 Supernota" },
          { key: "superinvestors", label: "🏛 Superinversores" },
          { key: "favai", label: "🧠 Favoritos + Análisis" },
          { key: "market", label: "🌐 Mercado" },
          { key: "ticker", label: "📊 Mis Favoritos" },
          { key: "finnhub", label: "📡 Finnhub" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedTicker(null); }}
            className="liquid-btn"
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
            <Column gap="m">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} shape="block" height="l" fillWidth radius="m" />
              ))}
            </Column>
          ) : summaries.length > 0 ? (
            <Column gap="m" fillWidth>
              {summaries.map((s, i) => (
                <DailySummaryCard
                  key={s.date}
                  date={s.date}
                  content={s.content}
                  createdAt={s.createdAt}
                  isLatest={i === 0}
                />
              ))}
              <Row horizontal="end">
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="liquid-btn"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--brand-strong)",
                    background: "var(--brand-alpha-weak)",
                    color: "var(--brand-on-background-strong)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Historial
                </button>
              </Row>
            </Column>
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

      {tab === "superinvestors" && (
        <Column gap="m" fillWidth>
          {superLoading ? (
            <Column gap="m">{[1,2,3].map((i)=>(<Skeleton key={i} shape="block" height="l" fillWidth radius="m" />))}</Column>
          ) : superData?.changes?.length > 0 ? (
            <Column gap="l" fillWidth>
              <Row gap="s" fillWidth wrap>
                <Badge background="brand-alpha-weak" onBackground="brand-strong" paddingX="s" paddingY="xs"><Text variant="label-default-xs">Trimestre: {superData.date}</Text></Badge>
                <Text variant="label-default-xs" onBackground="neutral-weak">Se guarda histórico 1 año (4 trimestres) en KV · {superData.changes.length} inversores</Text>
              </Row>
              {superData.changes.map((inv: any)=>(
                <Column key={inv.investor} gap="s" padding="m" radius="l" style={{ border:"1px solid var(--neutral-alpha-weak)"}} className="liquid-glass-sm">
                  <Row gap="s" vertical="center" wrap>
                    <Badge background={inv.investor==="BERKSHIRE"?"brand-alpha-weak": inv.investor==="PERSHING_SQUARE"?"accent-alpha-weak":"neutral-alpha-weak"} onBackground="neutral-strong" paddingX="s" paddingY="xs"><Text variant="label-default-xs">{inv.investorName}</Text></Badge>
                    <Text variant="label-default-xs" onBackground="neutral-weak">{inv.investor==="BERKSHIRE"?"S&P 500 / Value": inv.investor==="PERSHING_SQUARE"?"Nasdaq / Big Tech":"Semis / IA"} · {new Date(inv.filedAt).toLocaleDateString("es-MX")}</Text>
                  </Row>
                  {[
                    { label:"🟢 NUEVAS", data: inv.topNew },
                    { label:"📈 AUMENTADAS", data: inv.topIncreased },
                    { label:"📉 REDUCIDAS", data: inv.topDecreased },
                    { label:"🔴 SALIDA TOTAL", data: inv.topSoldOut },
                  ].map((sec)=> sec.data.length>0 && (
                    <Column key={sec.label} gap="xs">
                      <Text variant="label-strong-xs" style={{ color:"var(--neutral-on-background-strong)"}}>{sec.label}</Text>
                      {sec.data.map((h:any)=>(
                        <Row key={`${inv.investor}-${h.ticker}`} gap="s" vertical="center" wrap style={{ paddingLeft:8}}>
                          <Text variant="label-strong-s" style={{ minWidth:70 }}>{h.ticker}</Text>
                          <Text variant="label-default-xs" onBackground="neutral-weak" style={{ flex:1, minWidth:120}}>{h.name}</Text>
                          <Text variant="label-default-xs" style={{ color: h.action==="DECREASED"||h.action==="SOLD_OUT"?"var(--danger-medium)":"var(--success-medium)"}}>{h.changePct>=0?`+${h.changePct.toFixed(1)}%`:`${h.changePct.toFixed(1)}%`}</Text>
                          <Text variant="label-default-xs" onBackground="neutral-weak">{h.currShares>0? `${h.currShares.toLocaleString()} acc · $${(h.currValue/1e3).toFixed(0)}K` : `${h.prevShares.toLocaleString()} vendidas`}</Text>
                        </Row>
                      ))}
                    </Column>
                  ))}
                  {superHistory && (superHistory as any)[inv.investor]?.length>1 && (
                    <Column gap="xs" style={{ marginTop:8, borderTop:"1px solid var(--neutral-alpha-weak)", paddingTop:8}}>
                      <Text variant="label-default-xs" onBackground="neutral-weak">Histórico 1 año ({(superHistory as any)[inv.investor].length} trimestres): {(superHistory as any)[inv.investor].map((f:any)=> f.quarterEnd).join(" · ")}</Text>
                    </Column>
                  )}
                </Column>
              ))}
              <Text variant="label-default-xs" onBackground="neutral-weak" style={{ textAlign:"center"}}>Datos SEC EDGAR 13F-HR · Cada trimestre 45 días después del cierre</Text>
            </Column>
          ) : (
            <Column fillWidth horizontal="center" padding="xl" gap="s"><Text onBackground="neutral-weak">Sin datos 13F aún — se poblará al próximo filing o via cron</Text><Text variant="label-default-xs" onBackground="neutral-weak">Berkshire 0001067983 · Pershing 0001336528 · Duquesne 0001543152</Text></Column>
          )}
        </Column>
      )}

      {tab === "favai" && (
        favLoading ? (
          <Column gap="m" fillWidth>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} shape="block" height="l" fillWidth radius="m" />
            ))}
          </Column>
        ) : favBundle && favBundle.groups.length > 0 ? (
          <Column gap="l" fillWidth>
            <Row fillWidth horizontal="between" vertical="center">
              <Text variant="label-default-xs" onBackground="neutral-weak">
                Se actualiza 1 vez al día · {favBundle.groups.length} activos analizados
              </Text>
              <Row gap="s" vertical="center">
                <button
                  onClick={() => setAllGroups(!allOpen)}
                  className="liquid-btn"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--neutral-alpha-medium)",
                    background: "transparent",
                    color: "var(--neutral-on-background-weak)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {allOpen ? "Contraer todo" : "Expandir todo"}
                </button>
                <button
                  onClick={() => setFavRefresh(true)}
                  className="liquid-btn"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--brand-strong)",
                    background: "var(--brand-alpha-weak)",
                    color: "var(--brand-on-background-strong)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  ↻ Actualizar
                </button>
              </Row>
            </Row>

            {favBundle.macro && favBundle.macro.length > 0 && (
              <Row gap="s" fillWidth wrap>
                {favBundle.macro.filter((m) => m.value !== null).map((m, i) => (
                  <Badge
                    key={i}
                    background="neutral-alpha-weak"
                    onBackground="neutral-weak"
                    paddingX="s"
                    paddingY="xs"
                  >
                    <Text variant="label-default-xs">
                      {m.label}: {m.value}{m.unit}
                    </Text>
                  </Badge>
                ))}
              </Row>
            )}

            {favBundle.groups.map((group, gi) => {
              const open = Boolean(openGroups[group.ticker]);
              return (
                <Reveal key={group.ticker} delay={Math.min(gi * 0.05, 0.3)}>
                  <Column
                    gap="s"
                    fillWidth
                    padding={open ? "m" : "xs"}
                    radius="l"
                    className="liquid-glass-sm"
                    style={{
                      border: "1px solid var(--neutral-alpha-weak)",
                    }}
                  >
                    <button
                      onClick={() => toggleGroup(group.ticker)}
                      aria-expanded={open}
                      style={{
                        background: "transparent",
                        border: "none",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        borderRadius: 10,
                        padding: open ? "0 2px" : "8px 4px",
                      }}
                    >
                      <Row fillWidth horizontal="between" vertical="center">
                        <Row gap="s" vertical="center" fillWidth>
                          <Badge background="accent-alpha-weak" onBackground="accent-medium" paddingX="s" paddingY="xs">
                            <Text variant="label-default-xs">{group.ticker}</Text>
                          </Badge>
                          <Text variant="label-strong-s">{group.name}</Text>
                          {group.analysis && (
                            <Badge background="brand-alpha-weak" onBackground="brand-medium" paddingX="xs" paddingY="xs">
                              <Text variant="label-default-xs">IA</Text>
                            </Badge>
                          )}
                        </Row>
                        <Row gap="s" vertical="center">
                          <Text variant="label-default-xs" onBackground="neutral-weak">
                            {group.type === "crypto" ? "Crypto" : group.type === "etf" ? "ETF" : "Acción"} · {group.articles.length} noticias
                          </Text>
                          <Icon name={open ? "chevronUp" : "chevronDown"} size="s" onBackground="neutral-weak" />
                        </Row>
                      </Row>
                    </button>

                    {open && (
                      <Column gap="s" fillWidth>
                        {group.analysis && (
                          <Column
                            gap="xs"
                            padding="s"
                            radius="m"
                            fillWidth
                            style={{
                              background: "var(--brand-alpha-weak)",
                              border: "1px solid var(--brand-alpha-medium)",
                            }}
                          >
                            <Row gap="s" vertical="center">
                              <Badge background="brand-alpha-weak" onBackground="brand-medium" paddingX="s" paddingY="xs">
                                <Text variant="label-default-xs">ANÁLISIS MACRO</Text>
                              </Badge>
                            </Row>
                            <HighlightedText
                              text={group.analysis}
                              style={{
                                fontSize: "var(--font-size-body-s)",
                                color: "var(--neutral-on-background-strong)",
                              }}
                            />
                          </Column>
                        )}

                        {group.articles.length > 0 ? (
                          group.articles.map((article, i) => (
                            <Reveal key={`${group.ticker}-${article.url}-${i}`} delay={Math.min(i * 0.04, 0.2)}>
                              <NewsCard article={article} />
                            </Reveal>
                          ))
                        ) : (
                          <Text variant="body-default-s" onBackground="neutral-weak">
                            Sin noticias recientes para {group.ticker}.
                          </Text>
                        )}
                      </Column>
                    )}
                  </Column>
                </Reveal>
              );
            })}
          </Column>
        ) : (
          <Column fillWidth horizontal="center" padding="xl" gap="m">
            <Text variant="body-default-m" onBackground="neutral-weak">
              No hay noticias por ticker disponibles
            </Text>
            <Text variant="label-default-xs" onBackground="neutral-weak">
              Agrega activos a tu watchlist desde Favoritos
            </Text>
          </Column>
        )
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
                  className="liquid-btn"
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

      {tab === "finnhub" && (
        loading ? (
          <Column gap="m" fillWidth>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} shape="block" height="l" fillWidth radius="m" />
            ))}
          </Column>
        ) : finnhubData ? (
          <Column gap="l" fillWidth>
            {finnhubData.general.length > 0 && (
              <Column gap="m" fillWidth>
                <Row gap="s" vertical="center">
                  <Badge background="brand-alpha-weak" onBackground="brand-medium" paddingX="s" paddingY="xs">
                    <Text variant="label-default-xs">TOP 5 DEL DIA</Text>
                  </Badge>
                </Row>
                {finnhubData.general.map((article, i) => (
                  <FinnhubNewsCard key={`gen-${article.id || i}`} article={article} />
                ))}
              </Column>
            )}

            {finnhubData.favorites.length > 0 && (
              <Column gap="m" fillWidth>
                <Row gap="s" vertical="center">
                  <Badge background="accent-alpha-weak" onBackground="accent-medium" paddingX="s" paddingY="xs">
                    <Text variant="label-default-xs">TUS FAVORITOS</Text>
                  </Badge>
                </Row>
                {finnhubData.favorites.map((article, i) => (
                  <Reveal key={`fav-${article.id || i}`} delay={Math.min(i * 0.04, 0.3)}>
                    <Column gap="xs">
                      <Badge textVariant="label-default-xs" color="neutral" paddingX="xs">
                        {article._ticker}
                      </Badge>
                      <FinnhubNewsCard article={article} />
                    </Column>
                  </Reveal>
                ))}
              </Column>
            )}

            {finnhubData.general.length === 0 && finnhubData.favorites.length === 0 && (
              <Column fillWidth horizontal="center" padding="xl">
                <Text variant="body-default-m" onBackground="neutral-weak">
                  No hay noticias de Finnhub disponibles
                </Text>
              </Column>
            )}
          </Column>
        ) : (
          <Column fillWidth horizontal="center" padding="xl">
            <Text variant="body-default-m" onBackground="neutral-weak">
              No hay noticias disponibles
            </Text>
          </Column>
        )
      )}

      {tab !== "supernota" && tab !== "finnhub" && tab !== "favai" && (
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
                return (
                  <Reveal key={`finnhub-${finnhubArticle.id || i}`} delay={Math.min(i * 0.04, 0.3)}>
                    <FinnhubNewsCard article={finnhubArticle} />
                  </Reveal>
                );
              }
              const newsApiArticle = article as NewsArticle & { _source: string };
              return (
                <Reveal key={`${newsApiArticle.url}-${i}`} delay={Math.min(i * 0.04, 0.3)}>
                  <NewsCard article={newsApiArticle} />
                </Reveal>
              );
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
