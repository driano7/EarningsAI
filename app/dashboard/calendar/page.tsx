"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Column, Row, Heading, Text, Badge, Card, Grid, Button } from "@once-ui-system/core";
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

interface CryptoData {
  ticker: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCapUsd: number | null;
}

interface CalendarDay {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  events: Array<{ symbol: string; name: string; hour?: string; estimate?: number; actual?: number | null; surprisePercent?: number | null; type: "upcoming" | "past"; quarter?: string }>;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stockEarnings, setStockEarnings] = useState<EarningEvent[]>([]);
  const [cryptos, setCryptos] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const chatId = typeof window !== "undefined"
    ? localStorage.getItem("quartly_chatId") || "default"
    : "default";

  useEffect(() => {
    if (!chatId || chatId === "default") { setLoading(false); return; }
    const password = localStorage.getItem("quartly_auth");
    Promise.all([
      fetch("/api/dashboard/calendar?from=" + new Date().toISOString().split("T")[0], {
        headers: { Authorization: `Bearer ${password}` },
      }).then((r) => r.json()),
      fetch(`/api/dashboard/favorites/earnings?chatId=${chatId}`).then((r) => r.json()),
      fetch(`/api/dashboard/cryptos?chatId=${chatId}`).then((r) => r.json()),
    ]).then(([calData, earningsData, cryptoData]) => {
      if (calData.ok) setEvents(calData.events);
      if (earningsData.ok) {
        const all: EarningEvent[] = [];
        for (const s of earningsData.stocks || []) {
          if (s.earnings) all.push(...s.earnings);
        }
        setStockEarnings(all);
      }
      if (cryptoData.ok) setCryptos(cryptoData.cryptos);
    }).finally(() => setLoading(false));
  }, [chatId]);

  const stockEventMap = useMemo(() => {
    const map = new Map<string, CalendarDay["events"]>();
    for (const e of stockEarnings) {
      const d = e.period;
      if (!d) continue;
      if (!map.has(d)) map.set(d, []);
      const qLabel = `Q${e.quarter} ${e.year}`;
      map.get(d)!.push({
        symbol: e.symbol,
        name: e.symbol,
        type: "past",
        quarter: qLabel,
        estimate: e.estimate,
        actual: e.actual,
        surprisePercent: e.surprisePercent,
      });
    }
    return map;
  }, [stockEarnings]);

  const calendarEvents = useMemo(() => {
    const map = new Map<string, CalendarDay["events"]>(stockEventMap);
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push({
        symbol: e.symbol,
        name: e.name || e.symbol,
        hour: e.hour,
        type: "upcoming",
        estimate: e.estimate,
        actual: e.actual,
        surprisePercent: e.surprisePercent,
      });
    }
    return map;
  }, [events, stockEventMap]);

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: CalendarDay[] = [];

    for (let p = startPad - 1; p >= 0; p--) {
      const d = new Date(year, month, -p);
      const dateStr = toDateStr(d);
      days.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, events: calendarEvents.get(dateStr) || [] });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = toDateStr(d);
      days.push({ date: dateStr, day: i, isCurrentMonth: true, events: calendarEvents.get(dateStr) || [] });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = toDateStr(d);
      days.push({ date: dateStr, day: i, isCurrentMonth: false, events: calendarEvents.get(dateStr) || [] });
    }

    return days;
  }, [currentMonth, calendarEvents]);

  const today = toDateStr(new Date());

  const selectedDayEvents = selectedDate ? calendarEvents.get(selectedDate) || [] : [];
  const selectedDayName = selectedDate ? formatDate(selectedDate) : "";

  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
    setSelectedDate(null);
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
    setSelectedDate(null);
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(toDateStr(now));
  }, []);

  const allMonthEvents = calendarDays.filter((d) => d.isCurrentMonth && d.events.length > 0).length;

  return (
    <Column gap="l">
      <Heading variant="heading-strong-xl">Calendario de Earnings</Heading>

      {/* ── Calendar Grid ── */}
      <Card padding="m" radius="m" fillWidth>
        <Column gap="m">
          {/* Header */}
          <Row vertical="center" horizontal="between" wrap gap="s">
            <Row gap="s" vertical="center">
              <Button size="s" variant="tertiary" onClick={prevMonth}>‹</Button>
              <Heading variant="heading-strong-m">
                {MONTHS[currentMonth.month]} {currentMonth.year}
              </Heading>
              <Button size="s" variant="tertiary" onClick={nextMonth}>›</Button>
            </Row>
            <Row gap="s" vertical="center">
              <Button size="s" variant="secondary" onClick={goToday}>Hoy</Button>
              <Text variant="body-default-s" onBackground="neutral-weak">
                {allMonthEvents} día{allMonthEvents !== 1 ? "s" : ""} con earnings
              </Text>
            </Row>
          </Row>

          {/* Day-of-week headers */}
          <Grid columns="7" gap="xs">
            {DAYS.map((d) => (
              <Row key={d} horizontal="center">
                <Text variant="label-default-xs" onBackground="neutral-weak">
                  {d}
                </Text>
              </Row>
            ))}
          </Grid>

          {/* Calendar body */}
          <Grid columns="7" gap="xs">
            {calendarDays.map((day) => {
              const isToday = day.date === today;
              const isSelected = day.date === selectedDate;
              const hasEvents = day.events.length > 0;
              const maxDots = Math.min(day.events.length, 3);
              const extra = day.events.length - 3;

              return (
                <Column
                  key={day.date}
                  padding="xs"
                  radius="m"
                  gap="xs"
                  style={{
                    minHeight: 72,
                    background: isSelected
                      ? "var(--brand-alpha-medium)"
                      : isToday
                      ? "var(--neutral-alpha-weak)"
                      : "transparent",
                    border: isSelected
                      ? "2px solid var(--brand-on-background-strong)"
                      : isToday
                      ? "1px solid var(--neutral-alpha-medium)"
                      : "1px solid transparent",
                    opacity: day.isCurrentMonth ? 1 : 0.3,
                    cursor: hasEvents ? "pointer" : "default",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => hasEvents && setSelectedDate(day.date)}
                >
                  <Text variant="label-default-s" onBackground={isSelected || isToday ? "brand-strong" : "neutral-strong"}>
                    {day.day}
                  </Text>
                  {hasEvents && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {day.events.slice(0, maxDots).map((ev, i) => (
                        <Row key={i} gap={2} vertical="center">
                          <Badge
                            textVariant="label-default-xs"
                            color={ev.type === "upcoming" ? "brand" : "neutral"}
                            style={{ fontSize: 9, padding: "0 4px", lineHeight: "14px" }}
                          >
                            {ev.symbol}
                          </Badge>
                        </Row>
                      ))}
                      {extra > 0 && (
                        <Text variant="label-default-xs" onBackground="neutral-weak">
                          +{extra} más
                        </Text>
                      )}
                    </div>
                  )}
                </Column>
              );
            })}
          </Grid>
        </Column>
      </Card>

      {/* ── Selected Day Detail ── */}
      {selectedDate && (
        <Column gap="s">
          <Heading variant="heading-strong-s">{selectedDayName}</Heading>
          {selectedDayEvents.length === 0 ? (
            <Text variant="body-default-m" onBackground="neutral-weak">Sin earnings este día</Text>
          ) : (
            <Column gap="s">
              {selectedDayEvents.map((ev, i) => (
                <Card key={`${ev.symbol}-${i}`} padding="m" radius="m" fillWidth>
                  <Row vertical="center" horizontal="between" wrap gap="s">
                    <Row gap="m" vertical="center">
                      <Badge textVariant="label-default-s" color={ev.type === "upcoming" ? "brand" : "neutral"}>
                        {ev.symbol}
                      </Badge>
                      <Column gap="xs">
                        <Row gap="s" vertical="center">
                          <Text variant="body-default-m">{ev.name}</Text>
                          {ev.type === "upcoming"
                            ? <Badge textVariant="label-default-xs" color="brand">Próximo</Badge>
                            : <Badge textVariant="label-default-xs" color="neutral">Histórico</Badge>
                          }
                          {ev.hour && <Badge textVariant="label-default-xs" color="neutral">{ev.hour}</Badge>}
                        </Row>
                        {ev.quarter && (
                          <Text variant="body-default-s" onBackground="neutral-weak">{ev.quarter}</Text>
                        )}
                        <Text variant="body-default-s" onBackground="neutral-weak">
                          Est: ${ev.estimate?.toFixed(2) ?? "—"}
                          {ev.actual !== null && ev.actual !== undefined ? ` | Real: $${ev.actual.toFixed(2)}` : ""}
                          {ev.surprisePercent !== null && ev.surprisePercent !== undefined
                            ? ` | ${ev.surprisePercent >= 0 ? "+" : ""}${ev.surprisePercent.toFixed(1)}% ${ev.surprisePercent >= 0 ? "Beat ✅" : "Miss ❌"}`
                            : ""}
                        </Text>
                      </Column>
                    </Row>
                  </Row>
                </Card>
              ))}
            </Column>
          )}
        </Column>
      )}

      {/* ── Stats ── */}
      <Card padding="m" radius="m" fillWidth>
        <Row gap="l" wrap>
          <Column gap="xs">
            <Text variant="label-default-xs" onBackground="neutral-weak">Próximos eventos</Text>
            <Text variant="heading-strong-m">{events.length}</Text>
          </Column>
          <Column gap="xs">
            <Text variant="label-default-xs" onBackground="neutral-weak">Tus stocks con earnings</Text>
            <Text variant="heading-strong-m">{stockEarnings.length > 0 ? [...new Set(stockEarnings.map((e) => e.symbol))].length : 0}</Text>
          </Column>
          <Column gap="xs">
            <Text variant="label-default-xs" onBackground="neutral-weak">Mes actual</Text>
            <Text variant="heading-strong-m">{allMonthEvents} días</Text>
          </Column>
        </Row>
      </Card>

      {/* ── Mis Cryptos ── */}
      <Column gap="s">
        <Heading variant="heading-strong-xl">Mis Cryptos</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Tus criptomonedas favoritas — sincronizado con Telegram
        </Text>
      </Column>

      {loading ? (
        <Text>Cargando...</Text>
      ) : cryptos.length === 0 ? (
        <Card padding="l" radius="m" fillWidth>
          <Column horizontal="center" gap="s" padding="l">
            <Text variant="body-default-m" onBackground="neutral-weak">
              No tienes cryptos en tu watchlist.
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
          🔄 Earnings pasados basados en el periodo del reporte trimestral (Finnhub) · Próximos earnings del calendario general · Cryptos sincronizados con Telegram
        </Text>
      </Row>
    </Column>
  );
}
