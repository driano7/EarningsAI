"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, Card, Grid } from "@once-ui-system/core";
import { formatPercent } from "@/lib/formatFinance";

interface CalendarEvent {
  symbol: string;
  name: string;
  date: string;
  hour: string;
  estimate: number;
  actual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

interface CryptoData {
  ticker: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCapUsd: number | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cryptos, setCryptos] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const chatId = typeof window !== "undefined"
    ? localStorage.getItem("quartly_chatId") || "default"
    : "default";

  useEffect(() => {
    const password = localStorage.getItem("quartly_auth");
    Promise.all([
      fetch("/api/dashboard/calendar?from=" + new Date().toISOString().split("T")[0], {
        headers: { Authorization: `Bearer ${password}` },
      }).then((r) => r.json()),
      fetch(`/api/dashboard/cryptos?chatId=${chatId}`).then((r) => r.json()),
    ]).then(([calData, cryptoData]) => {
      if (calData.ok) setEvents(calData.events);
      if (cryptoData.ok) setCryptos(cryptoData.cryptos);
    }).finally(() => {
      setLoading(false);
      setCryptoLoading(false);
    });
  }, [chatId]);

  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <Column gap="l">
      {/* ── EARNINGS CALENDAR ── */}
      <Column gap="s">
        <Heading variant="heading-strong-xl">Calendario de Earnings</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Próximos reportes de earnings (14 días)
        </Text>
      </Column>

      <Card padding="m" radius="m" className="glass-card" fillWidth>
        <Row gap="m" vertical="center" wrap>
          {["all", "BMO", "AMC", "TDAY"].map((opt) => (
            <Badge
              key={opt}
              textVariant="label-default-s"
              color={filter === opt ? "brand" : "neutral"}
              style={{ cursor: "pointer" }}
              onClick={() => setFilter(opt)}
            >
              {opt === "all" ? "Todos" : opt}
            </Badge>
          ))}
          <Text variant="body-default-s" onBackground="neutral-weak" style={{ marginLeft: "auto" }}>
            {events.length} eventos
          </Text>
        </Row>
      </Card>

      {loading ? (
        <Text>Cargando calendario...</Text>
      ) : (
        <Column gap="l">
          {sortedDates.map((date) => {
            const dayEvents = grouped[date].filter(
              (e) => filter === "all" || e.hour === filter
            );
            if (dayEvents.length === 0) return null;

            return (
              <Column key={date} gap="s">
                <Heading variant="heading-strong-s">{formatDate(date)}</Heading>
                {dayEvents.map((ev) => (
                  <Row
                    key={`${ev.symbol}-${ev.date}`}
                    padding="m"
                    radius="m"
                    fillWidth
                    vertical="center"
                    horizontal="between"
                    className="glass-card"
                  >
                    <Row gap="m" vertical="center">
                      <Badge textVariant="label-default-s" color="brand">
                        {ev.symbol}
                      </Badge>
                      <Column gap="xs">
                        <Text variant="body-default-m">{ev.name || ev.symbol}</Text>
                        <Text variant="body-default-s" onBackground="neutral-weak">
                          Est: ${ev.estimate.toFixed(2)}
                          {ev.actual !== null ? ` | Real: $${ev.actual.toFixed(2)}` : ""}
                          {ev.surprisePercent !== null
                            ? ` | ${ev.surprisePercent >= 0 ? "+" : ""}${ev.surprisePercent.toFixed(1)}%`
                            : ""}
                        </Text>
                      </Column>
                    </Row>
                    <Badge
                      textVariant="label-default-s"
                      color={ev.actual !== null ? "brand" : "neutral"}
                    >
                      {ev.hour || "N/A"}
                      {ev.actual !== null ? " ✓" : ""}
                    </Badge>
                  </Row>
                ))}
              </Column>
            );
          })}
          {Object.keys(grouped).length === 0 && (
            <Text variant="body-default-m" onBackground="neutral-weak">
              No hay earnings programados en los próximos 14 días
            </Text>
          )}
        </Column>
      )}

      {/* ── MIS CRYPTOS ── */}
      <Column gap="s">
        <Heading variant="heading-strong-xl">Mis Cryptos</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Tus criptomonedas favoritas — sincronizado con Telegram
        </Text>
      </Column>

      {cryptoLoading ? (
        <Text>Cargando cryptos...</Text>
      ) : cryptos.length === 0 ? (
        <Card padding="l" radius="m" fillWidth>
          <Column horizontal="center" gap="s" padding="l">
            <Text variant="body-default-m" onBackground="neutral-weak">
              No tienes cryptos en tu watchlist. Agrégalas desde el bot de Telegram con @earningsinfoaibot.
            </Text>
          </Column>
        </Card>
      ) : (
        <Grid columns="3" gap="m" l={{ columns: 2 }} s={{ columns: 1 }}>
          {cryptos.map((c) => {
            const changeColor = c.change24h !== null
              ? (c.change24h >= 0 ? "success-medium" : "danger-medium")
              : "neutral-weak";
            return (
              <Card key={c.ticker} padding="m" radius="m" fillWidth>
                <Column gap="s">
                  <Row vertical="center" gap="s">
                    <Badge textVariant="label-default-s" color="brand">{c.ticker}</Badge>
                    <Text variant="body-default-s" onBackground="neutral-weak">{c.name}</Text>
                  </Row>
                  <Text variant="heading-strong-m">
                    {c.priceUsd !== null ? `$${c.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </Text>
                  <Row gap="m">
                    <Column gap="xs">
                      <Text variant="label-default-xs" onBackground="neutral-weak">24h</Text>
                      <Text variant="label-strong-s" onBackground={changeColor}>
                        {c.change24h !== null ? formatPercent(c.change24h) : "—"}
                      </Text>
                    </Column>
                    <Column gap="xs">
                      <Text variant="label-default-xs" onBackground="neutral-weak">7d</Text>
                      <Text variant="label-strong-s" onBackground={
                        c.change7d !== null ? (c.change7d >= 0 ? "success-medium" : "danger-medium") : "neutral-weak"
                      }>
                        {c.change7d !== null ? formatPercent(c.change7d) : "—"}
                      </Text>
                    </Column>
                    <Column gap="xs">
                      <Text variant="label-default-xs" onBackground="neutral-weak">Market Cap</Text>
                      <Text variant="label-strong-s">
                        {c.marketCapUsd !== null ? `$${(c.marketCapUsd / 1_000_000_000).toFixed(1)}B` : "—"}
                      </Text>
                    </Column>
                  </Row>
                </Column>
              </Card>
            );
          })}
        </Grid>
      )}

      <Row gap="s" vertical="center" padding="s">
        <Text variant="label-default-xs" onBackground="neutral-weak">
          🔄 Los cambios hechos en Telegram (agregar/eliminar cryptos con @earningsinfoaibot) se reflejan aquí automáticamente.
        </Text>
      </Row>
    </Column>
  );
}
