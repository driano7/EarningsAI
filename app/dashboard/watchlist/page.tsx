"use client";

import { useEffect, useState, useMemo } from "react";
import { Column, Row, Heading, Text, Badge, Card, IconButton, Grid } from "@once-ui-system/core";
import { returns, annualizedVolatility, maxDrawdown, sharpeRatio } from "@/lib/gs-quant";
import { formatPercent } from "@/lib/formatFinance";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
import { exportCsvDownload, exportXlsxDownload } from "@/lib/chart-utils";

interface TickerData {
  ticker: string;
  name: string;
  sector: string;
  type: "stock" | "etf" | "custom" | "unknown";
  users: number;
}

interface PricePoint {
  date: string;
  close: number;
}

type Period = "1w" | "1m" | "3m" | "1y";

export default function WatchlistPage() {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("1m");

  useEffect(() => {
    const password = localStorage.getItem("quartly_auth");
    fetch("/api/dashboard/watchlist", {
      headers: { Authorization: `Bearer ${password}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTickers(data.tickers);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTicker) return;
    setHistoryLoading(true);
    const password = localStorage.getItem("quartly_auth");
    fetch(`/api/dashboard/watchlist/history?ticker=${selectedTicker}&period=${period}`, {
      headers: { Authorization: `Bearer ${password}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPriceHistory(data.prices || []);
      })
      .finally(() => setHistoryLoading(false));
  }, [selectedTicker, period]);

  const analytics = useMemo(() => {
    if (priceHistory.length < 2) return null;
    const p = priceHistory.map((ph) => ph.close);
    const r = returns(p);
    return {
      totalReturn: (p[p.length - 1] - p[0]) / p[0],
      annualizedVol: r.length >= 2 ? annualizedVolatility(r) : null,
      maxDrawdown: maxDrawdown(p),
      sharpe: r.length >= 2 ? sharpeRatio(r) : null,
    };
  }, [priceHistory]);

  const filtered = tickers.filter(
    (t) =>
      t.ticker.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  const typeColors: Record<string, "brand" | "accent" | "neutral"> = {
    stock: "brand",
    etf: "accent",
    custom: "accent",
    unknown: "neutral",
  };

  const selectedInfo = tickers.find((t) => t.ticker === selectedTicker);

  const csvHeaders = ["Fecha", "Precio"];
  const csvRows = priceHistory.map((p) => [p.date, p.close]);

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Watchlist Global</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Todos los tickers rastreados por los usuarios
        </Text>
      </Column>

      <Card padding="m" radius="m" className="glass-card" fillWidth>
        <Row gap="m" vertical="center" wrap>
          <input
            type="text"
            placeholder="Buscar ticker o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "var(--space-xs) var(--space-s)",
              borderRadius: "var(--radius-s)",
              border: "1px solid var(--neutral-alpha-medium)",
              background: "var(--neutral-alpha-weak)",
              color: "inherit",
              minWidth: 200,
            }}
          />
          <Text variant="body-default-s" onBackground="neutral-weak">
            {filtered.length} de {tickers.length} tickers
          </Text>
        </Row>
      </Card>

      {selectedTicker && selectedInfo && (
        <Column gap="s">
          <Row vertical="center" horizontal="between" fillWidth>
            <Row gap="s" vertical="center">
              <Badge textVariant="label-default-s" color="brand">{selectedTicker}</Badge>
              <Text variant="body-default-m">{selectedInfo.name} — {selectedInfo.sector}</Text>
            </Row>
            <IconButton
              icon="remove"
              onClick={() => setSelectedTicker(null)}
              size="s"
              variant="tertiary"
              tooltip="Cerrar"
            />
          </Row>

          <Row gap="s">
            {(["1w", "1m", "3m", "1y"] as Period[]).map((p) => (
              <Badge
                key={p}
                textVariant="label-default-s"
                color={period === p ? "brand" : "neutral"}
                style={{ cursor: "pointer" }}
                onClick={() => setPeriod(p)}
              >
                {p === "1w" ? "1 semana" : p === "1m" ? "1 mes" : p === "3m" ? "3 meses" : "1 año"}
              </Badge>
            ))}
          </Row>

          <ChartCard
            title={`${selectedTicker} — Precio`}
            subtitle={`Historial (${period})`}
            filename={`${selectedTicker}-${period}`}
            height={300}
          >
            {historyLoading ? (
              <Text>Cargando...</Text>
            ) : priceHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-weak)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 10 }} />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 11 }}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--neutral-alpha-weak)", border: "1px solid var(--neutral-alpha-medium)", borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="close" stroke="var(--brand-on-background-strong)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Text variant="body-default-s" onBackground="neutral-weak">
                Sin datos históricos disponibles
              </Text>
            )}
    </ChartCard>

    {analytics && (
      <Card padding="l" radius="m" fillWidth>
        <Column gap="m">
          <Heading variant="heading-strong-m">Analítica</Heading>
          <Grid columns="4" gap="m" l={{ columns: 2 }} s={{ columns: 2 }}>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Rendimiento Total</Text>
              <Text variant="label-strong-m" onBackground={analytics.totalReturn >= 0 ? "success-medium" : "danger-medium"}>
                {formatPercent(analytics.totalReturn * 100)}
              </Text>
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Volatilidad (anual)</Text>
              <Text variant="label-strong-m">
                {analytics.annualizedVol !== null ? formatPercent(analytics.annualizedVol * 100) : "—"}
              </Text>
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Máx. Drawdown</Text>
              <Text variant="label-strong-m" onBackground="danger-medium">
                {formatPercent(-analytics.maxDrawdown * 100)}
              </Text>
            </Column>
            <Column padding="16" background="surface" radius="m" border="neutral-alpha-medium" gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Sharpe Ratio</Text>
              <Text variant="label-strong-m" onBackground={
                analytics.sharpe >= 2 ? "success-medium" : analytics.sharpe >= 1 ? "brand-medium" : analytics.sharpe >= 0 ? "warning-medium" : "danger-medium"
              }>
                {analytics.sharpe !== null ? analytics.sharpe.toFixed(2) : "—"}
              </Text>
            </Column>
          </Grid>
        </Column>
      </Card>
    )}

    {priceHistory.length > 0 && (
      <Row gap="s" padding="s">
        <IconButton
          icon="download"
          onClick={() => exportCsvDownload(csvHeaders, csvRows, `${selectedTicker}-${period}.csv`)}
          size="s"
          variant="tertiary"
          tooltip="CSV"
        />
        <IconButton
          icon="download"
          onClick={() => exportXlsxDownload(csvHeaders, csvRows, `${selectedTicker}-${period}.xlsx`)}
          size="s"
          variant="tertiary"
          tooltip="XLSX"
        />
      </Row>
    )}
        </Column>
      )}

      <Column gap="s">
        {filtered.map((ticker) => (
          <Row
            key={ticker.ticker}
            padding="m"
            radius="m"
            fillWidth
            vertical="center"
            horizontal="between"
            className="glass-card"
            style={{ cursor: "pointer" }}
            onClick={() => setSelectedTicker(ticker.ticker)}
          >
            <Row gap="m" vertical="center">
              <Badge textVariant="label-default-s">{ticker.ticker}</Badge>
              <Column gap="xs">
                <Text variant="body-default-m">{ticker.name}</Text>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {ticker.sector}
                </Text>
              </Column>
            </Row>
            <Row gap="m" vertical="center">
              <Badge textVariant="label-default-s" color={typeColors[ticker.type]}>
                {ticker.type}
              </Badge>
              <Text variant="body-default-m" onBackground="neutral-weak">
                {ticker.users} usuario{ticker.users !== 1 ? "s" : ""}
              </Text>
            </Row>
          </Row>
        ))}
        {filtered.length === 0 && !loading && (
          <Text variant="body-default-m" onBackground="neutral-weak">
            No se encontraron tickers
          </Text>
        )}
      </Column>
    </Column>
  );
}
