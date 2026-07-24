"use client";

import { useEffect, useState, useCallback } from "react";
import { Column, Row, Heading, Text, Badge, Card, Button, Input, IconButton, Grid } from "@once-ui-system/core";
import { formatPercent } from "@/lib/formatFinance";
import { getChartLineColor } from "@/lib/chartColors";
import { TickerDetailChart } from "@/components/dashboard/TickerDetailChart";

function Sparkline({ data, color, width = 120, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color || "var(--cyan-400)"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface EarningEvent {
  symbol: string;
  actual: number | null;
  estimate: number;
  surprise: number | null;
  surprisePercent: number | null;
  year: number;
  quarter: number;
  period: string;
}

interface RecommendationTrend {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
}

interface QuoteData {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

interface StockDetail {
  ticker: string;
  logo: string | null;
  earnings: EarningEvent[];
  analystSignals: RecommendationTrend[];
  quote: QuoteData | null;
  sparkline: number[];
}

interface EtfDetail {
  ticker: string;
  logo: string | null;
  quote: QuoteData | null;
  sparkline: number[];
}

interface CryptoDetail {
  ticker: string;
  logo: string | null;
  priceUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCapUsd: number | null;
  sparkline: number[];
}

interface FavStock { ticker: string; name: string; sector: string; type: "stock"; }
interface FavEtf { ticker: string; name: string; sector: string; type: "etf"; }
interface FavCrypto { ticker: string; name: string; priceUsd: number | null; change24h: number | null; type: "crypto"; }
type FavItem = FavStock | FavEtf | FavCrypto;
type TabType = "cryptos" | "stocks" | "etfs";

export default function FavoritesPage() {
  const [cryptos, setCryptos] = useState<FavCrypto[]>([]);
  const [stocks, setStocks] = useState<FavStock[]>([]);
  const [etfs, setEtfs] = useState<FavEtf[]>([]);
  const [stockDetails, setStockDetails] = useState<Map<string, StockDetail>>(new Map());
  const [etfDetails, setEtfDetails] = useState<Map<string, EtfDetail>>(new Map());
  const [cryptoDetails, setCryptoDetails] = useState<Map<string, CryptoDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [tab, setTab] = useState<TabType>("cryptos");
  const [addTicker, setAddTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [chatId, setChatId] = useState<string>("");
  const [knownUsers, setKnownUsers] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [selectedTicker, setSelectedTicker] = useState<{ ticker: string; type: "stock" | "etf" | "crypto" } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("quartly_chatId") || "";
    if (stored) {
      setChatId(stored);
    } else {
      fetch("/api/auth/users").then((r) => r.json()).then((data) => {
        if (data.ok && data.users.length > 0) {
          setKnownUsers(data.users);
          if (data.users.length === 1) {
            setChatId(data.users[0]);
            localStorage.setItem("quartly_chatId", data.users[0]);
          } else {
            setShowUserPicker(true);
          }
        }
      }).catch(() => {});
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/favorites?chatId=${chatId}`);
      const data = await res.json();
      if (data.ok) {
        setStocks(data.stocks || []);
        setEtfs(data.etfs || []);
        setCryptos(data.cryptos || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [chatId]);

  const fetchEarnings = useCallback(async () => {
    if (!chatId) return;
    setEarningsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/favorites/earnings?chatId=${chatId}`);
      const data = await res.json();
      if (data.ok) {
        const sMap = new Map<string, StockDetail>();
        for (const s of data.stocks) sMap.set(s.ticker, s);
        setStockDetails(sMap);
        const eMap = new Map<string, EtfDetail>();
        for (const e of data.etfs) eMap.set(e.ticker, e);
        setEtfDetails(eMap);
        const cMap = new Map<string, CryptoDetail>();
        for (const c of (data.cryptos || [])) cMap.set(c.ticker, c);
        setCryptoDetails(cMap);
      }
    } catch { /* ignore */ }
    setEarningsLoading(false);
  }, [chatId]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);
  useEffect(() => { if (chatId) fetchEarnings(); }, [chatId, fetchEarnings]);

  function selectChatId(id: string) {
    localStorage.setItem("quartly_chatId", id);
    setChatId(id);
    setShowUserPicker(false);
  }

  async function handleAdd() {
    if (!addTicker.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/dashboard/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, ticker: addTicker.toUpperCase(), type: tab === "cryptos" ? "crypto" : tab === "etfs" ? "etf" : "stock" }),
      });
      setAddTicker("");
      fetchFavorites();
    } catch { /* ignore */ }
    setAdding(false);
  }

  async function handleRemove(ticker: string, type: string) {
    try {
      await fetch("/api/dashboard/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, ticker, type }),
      });
      fetchFavorites();
    } catch { /* ignore */ }
  }

  function formatEarnings(earnings: EarningEvent[]): string {
    if (!earnings || earnings.length === 0) return "";
    const last = earnings[0];
    const act = last.actual !== null && last.actual !== undefined ? `$${last.actual.toFixed(2)}` : "N/A";
    const est = `$${last.estimate.toFixed(2)}`;
    let beat = "";
    if (last.surprisePercent !== null && last.surprisePercent !== undefined) {
      const sign = last.surprisePercent >= 0 ? "+" : "";
      beat = ` (${sign}${last.surprisePercent.toFixed(1)}% ${last.surprisePercent >= 0 ? "Beat ✅" : "Miss ❌"})`;
    }
    return `Q${last.quarter} ${last.year}: est ${est} → ${act}${beat}`;
  }

  function formatAnalystSignal(recs: RecommendationTrend[]): string {
    if (!recs || recs.length === 0) return "";
    const r = recs[0];
    const parts: string[] = [];
    if (r.strongBuy > 0) parts.push(`🟢${r.strongBuy}`);
    if (r.buy > 0) parts.push(`🟢${r.buy}`);
    if (r.hold > 0) parts.push(`⚪${r.hold}`);
    if (r.sell > 0) parts.push(`🔴${r.sell}`);
    if (r.strongSell > 0) parts.push(`🔴${r.strongSell}`);
    return parts.join(" ");
  }

  const activeItems: FavItem[] = tab === "cryptos" ? cryptos : tab === "stocks" ? stocks : etfs;

  if (showUserPicker) {
    return (
      <Column fillWidth minHeight="100vh" horizontal="center" vertical="center" padding="l">
        <Column maxWidth="xs" gap="l" padding="xl" radius="m"
          style={{
            background: "var(--neutral-alpha-weak)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--neutral-alpha-medium)",
          }}
        >
          <Column gap="s" horizontal="center">
            <Heading variant="display-strong-xs">Selecciona tu cuenta</Heading>
            <Text variant="body-default-m" onBackground="neutral-weak">
              Elige tu cuenta de KV para cargar tus favoritos:
            </Text>
          </Column>
          <Column gap="s">
            {knownUsers.map((uid) => (
              <Card key={uid} padding="m" radius="m" fillWidth
                style={{ cursor: "pointer" }}
                onClick={() => selectChatId(uid)}
              >
                <Row vertical="center" gap="s">
                  <Text variant="body-default-l">🤖</Text>
                  <Column gap="xs">
                    <Text variant="label-strong-s">Chat ID: {uid}</Text>
                    <Text variant="label-default-xs" onBackground="neutral-weak">Haz clic para usar esta cuenta</Text>
                  </Column>
                </Row>
              </Card>
            ))}
          </Column>
        </Column>
      </Column>
    );
  }

  return (
    <Column gap="l">
      <Row vertical="center" horizontal="between" wrap gap="s">
        <Column gap="s">
          <Heading variant="heading-strong-xl">Mis Favoritos</Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">
            Chat ID: {chatId || "No configurado"} · Datos cacheados en KV (24h)
          </Text>
        </Column>
        <Row gap="s" wrap>
          <Button size="s" variant="tertiary" onClick={() => { setStockDetails(new Map()); setEtfDetails(new Map()); setCryptoDetails(new Map()); fetchEarnings(); }}>
            Recargar datos
          </Button>
          <Button size="s" variant="tertiary" onClick={() => {
            localStorage.removeItem("quartly_chatId");
            setChatId("");
            setShowUserPicker(true);
            fetch("/api/auth/users").then((r) => r.json()).then((d) => {
              if (d.ok) setKnownUsers(d.users);
            }).catch(() => {});
          }}>
            Cambiar cuenta
          </Button>
        </Row>
      </Row>

      <Row gap="s" wrap>
        {(["cryptos", "stocks", "etfs"] as TabType[]).map((t) => (
          <Badge
            key={t}
            textVariant="label-default-s"
            color={tab === t ? "brand" : "neutral"}
            style={{ cursor: "pointer" }}
            onClick={() => setTab(t)}
          >
            {t === "cryptos" ? `🪙 Cryptos (${cryptos.length})` : t === "stocks" ? `📊 Stocks (${stocks.length})` : `📦 ETFs (${etfs.length})`}
          </Badge>
        ))}
      </Row>

      <Row gap="s" vertical="center" wrap>
        <Input
          id="add-ticker"
          label="Agregar ticker"
          placeholder={tab === "cryptos" ? "Ej: BTC, ETH, SOL" : "Ej: AAPL, MSFT"}
          value={addTicker}
          onChange={(e) => setAddTicker(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleAdd(); }}
          style={{ minWidth: 200, flex: 1 }}
        />
        <Button onClick={handleAdd} disabled={!addTicker.trim() || adding}>
          {adding ? "Agregando..." : "+ Agregar"}
        </Button>
      </Row>

      {loading ? (
        <Text>Cargando favoritos...</Text>
      ) : activeItems.length === 0 ? (
        <Card padding="l" radius="m" fillWidth>
          <Column horizontal="center" gap="s" padding="l">
            <Text variant="body-default-m" onBackground="neutral-weak">
              No tienes {tab === "cryptos" ? "cryptos" : tab === "stocks" ? "acciones" : "ETFs"} en tu watchlist.
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              Agrega usando el campo de arriba o desde Telegram con @earningsinfoaibot.
            </Text>
          </Column>
        </Card>
      ) : (
        <Grid columns="2" gap="m" s={{ columns: 1 }}>
          {activeItems.map((item) => {
            if (item.type === "crypto") {
              const c = item as FavCrypto;
              const detail = cryptoDetails.get(c.ticker);
              return (
                <Card key={c.ticker} padding="m" radius="m" fillWidth
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedTicker({ ticker: c.ticker, type: "crypto" })}
                >
                  <Row vertical="center" horizontal="between">
                    <Row gap="s" vertical="center">
                      {detail?.logo && !logoErrors.has(c.ticker) && (
                        <img
                          src={detail.logo}
                          alt={c.ticker}
                          style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "contain" }}
                          onError={() => setLogoErrors((prev) => new Set(prev).add(c.ticker))}
                        />
                      )}
                      <Column gap="xs">
                        <Row gap="s" vertical="center">
                          <Badge textVariant="label-default-s" color="brand">{c.ticker}</Badge>
                        </Row>
                        <Text variant="body-default-s">{c.name}</Text>
                        <Text variant="heading-strong-m">
                          {detail?.priceUsd ?? c.priceUsd !== null
                            ? `$${(detail?.priceUsd ?? c.priceUsd)!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </Text>
                        <Text variant="label-strong-s" onBackground={(detail?.change24h ?? c.change24h) !== null ? ((detail?.change24h ?? c.change24h)! >= 0 ? "success-medium" : "danger-medium") : "neutral-weak"}>
                          {(detail?.change24h ?? c.change24h) !== null ? formatPercent(detail?.change24h ?? c.change24h!) : "—"}
                        </Text>
                        {detail?.marketCapUsd != null && (
                          <Text variant="label-default-xs" onBackground="neutral-weak">
                            Cap: ${(detail.marketCapUsd / 1e9).toFixed(2)}B
                          </Text>
                        )}
                        {detail?.sparkline && detail.sparkline.length > 1 && (
                          <Sparkline data={detail.sparkline} color={getChartLineColor(detail.change24h)} />
                        )}
                      </Column>
                    </Row>
                    <IconButton icon="trash" size="s" variant="danger" onClick={() => handleRemove(c.ticker, "crypto")} tooltip="Eliminar" />
                  </Row>
                </Card>
              );
            }

            if (item.type === "etf") {
              const e = item as FavEtf;
              const detail = etfDetails.get(e.ticker);
              return (
                <Card key={e.ticker} padding="m" radius="m" fillWidth
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedTicker({ ticker: e.ticker, type: "etf" })}
                >
                  <Row vertical="center" horizontal="between">
                    <Row gap="s" vertical="center">
                      {detail?.logo && !logoErrors.has(e.ticker) && (
                        <img
                          src={detail.logo}
                          alt={e.ticker}
                          style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain" }}
                          onError={() => setLogoErrors((prev) => new Set(prev).add(e.ticker))}
                        />
                      )}
                      <Column gap="xs">
                        <Row gap="s" vertical="center">
                          <Badge textVariant="label-default-s" color="accent">{e.ticker}</Badge>
                        </Row>
                        <Text variant="body-default-s">{e.name}</Text>
                        {detail?.quote && (
                          <Text variant="heading-strong-s" onBackground={detail.quote.d >= 0 ? "success-medium" : "danger-medium"}>
                            ${detail.quote.c.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <Text variant="label-default-xs" onBackground={detail.quote.d >= 0 ? "success-medium" : "danger-medium"}>
                              {" "}{detail.quote.d >= 0 ? "+" : ""}{detail.quote.d.toFixed(2)} ({detail.quote.dp >= 0 ? "+" : ""}{detail.quote.dp.toFixed(2)}%)
                            </Text>
                          </Text>
                        )}
                        <Text variant="label-default-xs" onBackground="neutral-weak">{e.sector || "—"}</Text>
                        {detail?.sparkline && detail.sparkline.length > 1 && (
                          <Sparkline data={detail.sparkline} color={getChartLineColor(detail.quote?.d ?? null)} />
                        )}
                      </Column>
                    </Row>
                    <IconButton icon="trash" size="s" variant="danger" onClick={() => handleRemove(e.ticker, "etf")} tooltip="Eliminar" />
                  </Row>
                </Card>
              );
            }

            const s = item as FavStock;
            const detail = stockDetails.get(s.ticker);
            return (
              <Card key={s.ticker} padding="m" radius="m" fillWidth
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedTicker({ ticker: s.ticker, type: "stock" })}
              >
                <Row vertical="stretch" horizontal="between">
                  <Column gap="s" fillWidth>
                    <Row gap="s" vertical="center">
                      {detail?.logo && !logoErrors.has(s.ticker) && (
                        <img
                          src={detail.logo}
                          alt={s.ticker}
                          style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain" }}
                          onError={() => setLogoErrors((prev) => new Set(prev).add(s.ticker))}
                        />
                      )}
                      <Badge textVariant="label-default-s" color="brand">{s.ticker}</Badge>
                      <Row gap="xs" vertical="center">
                        <Text variant="body-default-s">{s.name}</Text>
                        <Text variant="label-default-xs" onBackground="neutral-weak">· {s.sector || "—"}</Text>
                      </Row>
                    </Row>

                    {detail?.quote && (
                      <Text variant="heading-strong-s" onBackground={detail.quote.d >= 0 ? "success-medium" : "danger-medium"}>
                        ${detail.quote.c.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <Text variant="label-default-xs" onBackground={detail.quote.d >= 0 ? "success-medium" : "danger-medium"}>
                          {" "}{detail.quote.d >= 0 ? "+" : ""}{detail.quote.d.toFixed(2)} ({detail.quote.dp >= 0 ? "+" : ""}{detail.quote.dp.toFixed(2)}%)
                        </Text>
                      </Text>
                    )}

                    {detail?.sparkline && detail.sparkline.length > 1 && (
                      <Sparkline data={detail.sparkline} color={getChartLineColor(detail.quote?.d ?? null)} />
                    )}

                    {detail && detail.earnings.length > 0 && (
                      <Text variant="label-default-s" onBackground="neutral-medium">
                        📋 {formatEarnings(detail.earnings)}
                      </Text>
                    )}

                    {detail && detail.analystSignals.length > 0 && (
                      <Row gap="xs" vertical="center">
                        <Text variant="label-default-xs" onBackground="neutral-weak">🎯 Analistas:</Text>
                        <Text variant="label-default-xs">{formatAnalystSignal(detail.analystSignals)}</Text>
                      </Row>
                    )}

                    {earningsLoading && (
                      <Text variant="label-default-xs" onBackground="neutral-weak">Cargando datos de reportes...</Text>
                    )}
                  </Column>
                  <IconButton icon="trash" size="s" variant="danger" onClick={() => handleRemove(s.ticker, "stock")} tooltip="Eliminar" style={{ alignSelf: "flex-start" }} />
                </Row>
              </Card>
            );
          })}
        </Grid>
      )}

      <Text variant="label-default-xs" onBackground="neutral-weak">
        🔄 Datos de reportes se actualizan cada 24h · Los cambios se sincronizan con Telegram
      </Text>

      {selectedTicker && (
        <TickerDetailChart
          ticker={selectedTicker.ticker}
          type={selectedTicker.type}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </Column>
  );
}
