"use client";

import { useEffect, useState, useCallback } from "react";
import { Column, Row, Heading, Text, Badge, Card, Button, Input, IconButton, Grid } from "@once-ui-system/core";
import { formatPercent } from "@/lib/formatFinance";

interface FavStock {
  ticker: string;
  name: string;
  sector: string;
  type: "stock";
}

interface FavEtf {
  ticker: string;
  name: string;
  sector: string;
  type: "etf";
}

interface FavCrypto {
  ticker: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
  type: "crypto";
}

type FavItem = FavStock | FavEtf | FavCrypto;
type TabType = "cryptos" | "stocks" | "etfs";

export default function FavoritesPage() {
  const [cryptos, setCryptos] = useState<FavCrypto[]>([]);
  const [stocks, setStocks] = useState<FavStock[]>([]);
  const [etfs, setEtfs] = useState<FavEtf[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("cryptos");
  const [addTicker, setAddTicker] = useState("");
  const [addType, setAddType] = useState<TabType>("cryptos");
  const [adding, setAdding] = useState(false);

  const chatId = typeof window !== "undefined"
    ? localStorage.getItem("quartly_chatId") || "default"
    : "default";

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/favorites?chatId=${chatId}`);
      const data = await res.json();
      if (data.ok) {
        setStocks(data.stocks);
        setEtfs(data.etfs);
        setCryptos(data.cryptos);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [chatId]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  async function handleAdd() {
    if (!addTicker.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/dashboard/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, ticker: addTicker.toUpperCase(), type: addType === "cryptos" ? "crypto" : addType === "etfs" ? "etf" : "stock" }),
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

  const activeItems: FavItem[] = tab === "cryptos" ? cryptos : tab === "stocks" ? stocks : etfs;

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Mis Favoritos</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Cryptos, acciones y ETFs en tu watchlist personal
        </Text>
      </Column>

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
          placeholder={tab === "cryptos" ? "Ej: BTC" : "Ej: AAPL"}
          value={addTicker}
          onChange={(e) => setAddTicker(e.target.value)}
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
              Agrega usando el campo de arriba.
            </Text>
          </Column>
        </Card>
      ) : (
        <Grid columns="2" gap="m" s={{ columns: 1 }}>
          {activeItems.map((item) => {
            if (item.type === "crypto") {
              const c = item as FavCrypto;
              return (
                <Card key={c.ticker} padding="m" radius="m" fillWidth>
                  <Row vertical="center" horizontal="between">
                    <Row gap="s" vertical="center">
                      <Badge textVariant="label-default-s" color="brand">{c.ticker}</Badge>
                      <Column gap="xs">
                        <Text variant="body-default-s">{c.name}</Text>
                        <Text variant="heading-strong-m">
                          {c.priceUsd !== null ? `$${c.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </Text>
                        <Text variant="label-strong-s" onBackground={c.change24h !== null ? (c.change24h >= 0 ? "success-medium" : "danger-medium") : "neutral-weak"}>
                          {c.change24h !== null ? formatPercent(c.change24h) : "—"}
                        </Text>
                      </Column>
                    </Row>
                    <IconButton
                      icon="trash"
                      size="s"
                      variant="danger"
                      onClick={() => handleRemove(c.ticker, "crypto")}
                      tooltip="Eliminar"
                    />
                  </Row>
                </Card>
              );
            }
            const s = item as FavStock | FavEtf;
            return (
              <Card key={s.ticker} padding="m" radius="m" fillWidth>
                <Row vertical="center" horizontal="between">
                  <Row gap="s" vertical="center">
                    <Badge textVariant="label-default-s" color={s.type === "etf" ? "accent" : "brand"}>{s.ticker}</Badge>
                    <Column gap="xs">
                      <Text variant="body-default-s">{s.name}</Text>
                      <Text variant="label-default-xs" onBackground="neutral-weak">{s.sector || "—"}</Text>
                    </Column>
                  </Row>
                  <IconButton
                    icon="trash"
                    size="s"
                    variant="danger"
                    onClick={() => handleRemove(s.ticker, s.type)}
                    tooltip="Eliminar"
                  />
                </Row>
              </Card>
            );
          })}
        </Grid>
      )}

      <Row gap="s" vertical="center" padding="s">
        <Text variant="label-default-xs" onBackground="neutral-weak">
          🔄 Datos sincronizados con KV — los cambios se reflejan en Telegram y viceversa.
        </Text>
      </Row>
    </Column>
  );
}
