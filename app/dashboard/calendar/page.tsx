/*
 * Quartly Bot — app/dashboard/calendar/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Column, Row, Heading, Text, Badge, Card, Grid, Button } from "@once-ui-system/core";
import { formatPercent } from "@/lib/formatFinance";
import { useEarningsCalendar, type CalendarEarningsTicker } from "@/hooks/useEarningsCalendar";
import { useNotifications } from "@/hooks/useNotifications";

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
  events: Array<{ symbol: string; name: string; logo?: string | null; hour?: string; estimate?: number; actual?: number | null; surprisePercent?: number | null; type: "upcoming" | "past"; quarter?: string }>;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stockEarnings, setStockEarnings] = useState<(EarningEvent & { logo?: string | null })[]>([]);
  const [cryptos, setCryptos] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { isSubscribed, subscribe, unsubscribe, loading: notifLoading } = useNotifications();
  const { dateMap: earningsDateMap, loading: earningsLoading } = useEarningsCalendar(currentMonth.year, currentMonth.month);

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
        const all: Array<EarningEvent & { logo?: string | null }> = [];
        for (const s of earningsData.stocks || []) {
          if (s.earnings) all.push(...s.earnings.map((e: EarningEvent) => ({ ...e, logo: s.logo })));
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
        logo: e.logo,
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
    const realMonth = month - 1;
    const firstDay = new Date(year, realMonth, 1);
    const lastDay = new Date(year, realMonth + 1, 0);
    const startPad = firstDay.getDay();
    const days: CalendarDay[] = [];

    for (let p = startPad - 1; p >= 0; p--) {
      const d = new Date(year, realMonth, -p);
      const dateStr = toDateStr(d);
      days.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, events: calendarEvents.get(dateStr) || [] });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, realMonth, i);
      const dateStr = toDateStr(d);
      days.push({ date: dateStr, day: i, isCurrentMonth: true, events: calendarEvents.get(dateStr) || [] });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, realMonth + 1, i);
      const dateStr = toDateStr(d);
      days.push({ date: dateStr, day: i, isCurrentMonth: false, events: calendarEvents.get(dateStr) || [] });
    }

    return days;
  }, [currentMonth, calendarEvents]);

  const today = toDateStr(new Date());

  const selectedDayEvents = selectedDate ? calendarEvents.get(selectedDate) || [] : [];
  const selectedDayEarnings = selectedDate ? earningsDateMap.get(selectedDate) || [] : [];
  const selectedDayName = selectedDate ? formatDate(selectedDate) : "";

  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { year: prev.year, month: prev.month - 1 };
    });
    setSelectedDate(null);
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: prev.month + 1 };
    });
    setSelectedDate(null);
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setSelectedDate(toDateStr(now));
  }, []);

  const allMonthEvents = calendarDays.filter((d) => d.isCurrentMonth && d.events.length > 0).length;
  const allMonthEarnings = calendarDays.filter((d) => d.isCurrentMonth && (earningsDateMap.get(d.date)?.length || 0) > 0).length;

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <Column gap="l">
      <Row vertical="center" horizontal="between" wrap gap="s">
        <Heading variant="heading-strong-xl">Calendario de Earnings</Heading>
        <Button
          size="s"
          variant={isSubscribed ? "secondary" : "primary"}
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={notifLoading}
          style={{ whiteSpace: "nowrap" }}
        >
          {notifLoading ? "..." : isSubscribed ? "🔔 Notificaciones ON" : "🔕 Activar notificaciones"}
        </Button>
      </Row>

      {/* ── Calendar Grid ── */}
      <Card padding="m" radius="m" fillWidth>
        <Column gap="m">
          {/* Header */}
          <Row vertical="center" horizontal="between" wrap gap="s">
            <Row gap="s" vertical="center">
              <Button size="s" variant="tertiary" onClick={prevMonth}>{"<"}</Button>
              <Heading variant="heading-strong-m">
                {MONTHS[currentMonth.month - 1]} {currentMonth.year}
              </Heading>
              <Button size="s" variant="tertiary" onClick={nextMonth}>{">"}</Button>
            </Row>
            <Row gap="s" vertical="center">
              <Button size="s" variant="secondary" onClick={goToday}>Hoy</Button>
              <Text variant="body-default-s" onBackground="neutral-weak">
                {allMonthEarnings > 0 ? `${allMonthEarnings} dia${allMonthEarnings !== 1 ? "s" : ""} con reportes` : `${allMonthEvents} evento${allMonthEvents !== 1 ? "s" : ""}`}
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
              const earningsTickers = earningsDateMap.get(day.date) || [];
              const hasEarnings = earningsTickers.length > 0;
              const hasUpcoming = day.events.some((e) => e.type === "upcoming");
              const maxLogos = 3;
              const logoEvents = [
                ...earningsTickers.map((t) => ({ ticker: t.ticker, logo: t.logo })),
                ...day.events
                  .filter((ev) => ev.type === "past")
                  .map((ev) => ({ ticker: ev.symbol, logo: ev.logo })),
              ].filter(
                (item, idx, arr) =>
                  item.logo && arr.findIndex((x) => x.ticker === item.ticker) === idx
              );
              const extraLogos = logoEvents.length - maxLogos;

              return (
                <Column
                  key={day.date}
                  padding="xs"
                  radius="m"
                  gap={4}
                  style={{
                    minHeight: 80,
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
                    cursor: hasEvents || hasEarnings ? "pointer" : "default",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                  onClick={() => (hasEvents || hasEarnings) && handleDayClick(day.date)}
                >
                  {/* Day number + dot */}
                  <Row gap={4} vertical="center">
                    <Text variant="label-default-s" onBackground={isSelected || isToday ? "brand-strong" : "neutral-strong"}>
                      {day.day}
                    </Text>
                    {(hasUpcoming || hasEarnings) && (
                      <Column
                        style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: hasEarnings ? "var(--brand-on-background-strong)" : "var(--danger-on-background-strong)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Row>

                  {/* Earnings logos */}
                  {logoEvents.length > 0 && (
                    <Row gap={2} style={{ flexWrap: "wrap" }}>
                      {logoEvents.slice(0, maxLogos).map((item, i) => (
                        <div
                          key={`${item.ticker}-${i}`}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            overflow: "hidden",
                            background: "var(--neutral-alpha-weak)",
                            flexShrink: 0,
                          }}
                          title={item.ticker}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.logo || `/api/logos/${item.ticker}`}
                            alt={item.ticker}
                            width={20}
                            height={20}
                            style={{ objectFit: "cover", width: "100%", height: "100%" }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ))}
                      {extraLogos > 0 && (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "var(--brand-alpha-medium)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 8,
                            color: "var(--brand-on-background-strong)",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          +{extraLogos}
                        </div>
                      )}
                    </Row>
                  )}
                  {logoEvents.length === 0 && hasEvents && (
                    <Column gap={2}>
                      {day.events.slice(0, 2).map((ev, i) => (
                        <Badge
                          key={i}
                          textVariant="label-default-xs"
                          color={ev.type === "upcoming" ? "brand" : "neutral"}
                          style={{ fontSize: 8, padding: "0 3px", lineHeight: "12px" }}
                        >
                          {ev.symbol}
                        </Badge>
                      ))}
                      {day.events.length > 2 && (
                        <Text variant="label-default-xs" onBackground="neutral-weak" style={{ fontSize: 8 }}>
                          +{day.events.length - 2}
                        </Text>
                      )}
                    </Column>
                  )}
                </Column>
              );
            })}
          </Grid>
        </Column>
      </Card>

      {/* ── Selected Day Detail ── */}
      {selectedDate && !showModal && (
        <Column gap="s">
          <Heading variant="heading-strong-s">{selectedDayName}</Heading>
          {selectedDayEvents.length === 0 && selectedDayEarnings.length === 0 ? (
            <Text variant="body-default-m" onBackground="neutral-weak">Sin earnings este dia</Text>
          ) : (
            <Column gap="s">
              {/* Earnings from cron (with logos) */}
              {selectedDayEarnings.map((ev, i) => (
                <Card key={`cron-${ev.ticker}-${i}`} padding="m" radius="m" fillWidth>
                  <Row vertical="center" horizontal="between" wrap gap="m">
                    <Row gap="m" vertical="center">
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          overflow: "hidden",
                          background: "var(--neutral-alpha-weak)",
                          flexShrink: 0,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ev.logo || `/api/logos/${ev.ticker}`}
                          alt={ev.ticker}
                          width={36}
                          height={36}
                          style={{ objectFit: "cover", width: "100%", height: "100%" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                      <Column gap="xs">
                        <Row gap="s" vertical="center">
                          <Badge textVariant="label-default-s" color="brand">{ev.ticker}</Badge>
                          <Text variant="body-default-m">{ev.name}</Text>
                        </Row>
                        {ev.hour && <Text variant="body-default-s" onBackground="neutral-weak">Hora: {ev.hour}</Text>}
                        <Text variant="body-default-s" onBackground="neutral-weak">
                          EPS estimado: ${ev.estimate?.toFixed(2) ?? "N/A"}
                        </Text>
                      </Column>
                    </Row>
                  </Row>
                </Card>
              ))}

              {/* Legacy events */}
              {selectedDayEvents.map((ev, i) => (
                <Card key={`legacy-${ev.symbol}-${i}`} padding="m" radius="m" fillWidth>
                  <Row vertical="center" horizontal="between" wrap gap="s">
                    <Row gap="m" vertical="center">
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          overflow: "hidden",
                          background: "var(--neutral-alpha-weak)",
                          flexShrink: 0,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ev.logo || `/api/logos/${ev.symbol}`}
                          alt={ev.symbol}
                          width={36}
                          height={36}
                          style={{ objectFit: "cover", width: "100%", height: "100%" }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                      <Column gap="xs">
                        <Row gap="s" vertical="center">
                          <Text variant="body-default-m">{ev.name}</Text>
                          {ev.type === "upcoming"
                            ? <Badge textVariant="label-default-xs" color="brand">Proximo</Badge>
                            : <Badge textVariant="label-default-xs" color="neutral">Historico</Badge>
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
                            ? ` | ${ev.surprisePercent >= 0 ? "+" : ""}${ev.surprisePercent.toFixed(1)}% ${ev.surprisePercent >= 0 ? "Beat" : "Miss"}`
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

      {/* ── Day Detail Modal ── */}
      {showModal && selectedDate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              background: "var(--neutral-background)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              backdropFilter: "blur(40px) saturate(1.8)",
              border: "1px solid var(--neutral-alpha-medium)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Column gap="m">
              <Row vertical="center" horizontal="between">
                <Heading variant="heading-strong-m">{selectedDayName}</Heading>
                <Button size="s" variant="tertiary" onClick={handleCloseModal}>X</Button>
              </Row>

              {selectedDayEarnings.length === 0 && selectedDayEvents.length === 0 ? (
                <Text variant="body-default-m" onBackground="neutral-weak">Sin reportes este dia</Text>
              ) : (
                <Column gap="m">
                  {/* Logos row */}
                  {(selectedDayEarnings.length > 0 || selectedDayEvents.length > 0) && (
                    <Row gap="s" style={{ flexWrap: "wrap" }}>
                      {selectedDayEarnings.map((ev, i) => (
                        <div
                          key={`${ev.ticker}-${i}`}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              overflow: "hidden",
                              background: "var(--neutral-alpha-weak)",
                              border: "2px solid var(--brand-alpha-medium)",
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={ev.logo || `/api/logos/${ev.ticker}`}
                              alt={ev.ticker}
                              width={48}
                              height={48}
                              style={{ objectFit: "cover", width: "100%", height: "100%" }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                          <Text variant="label-default-xs" onBackground="neutral-strong">{ev.ticker}</Text>
                        </div>
                      ))}
                      {selectedDayEvents
                        .filter((ev) => ev.type === "past" && !selectedDayEarnings.some((d) => d.ticker === ev.symbol))
                        .map((ev, i) => (
                          <div
                            key={`legacy-${ev.symbol}-${i}`}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                overflow: "hidden",
                                background: "var(--neutral-alpha-weak)",
                                border: "2px solid var(--brand-alpha-medium)",
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={ev.logo || `/api/logos/${ev.symbol}`}
                                alt={ev.symbol}
                                width={48}
                                height={48}
                                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                            <Text variant="label-default-xs" onBackground="neutral-strong">{ev.symbol}</Text>
                          </div>
                        ))}
                    </Row>
                  )}

                  {/* Details */}
                  {selectedDayEarnings.map((ev, i) => (
                    <Card key={`modal-cron-${ev.ticker}-${i}`} padding="m" radius="m" fillWidth>
                      <Row gap="m" vertical="center">
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            overflow: "hidden",
                            background: "var(--neutral-alpha-weak)",
                            flexShrink: 0,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ev.logo || `/api/logos/${ev.ticker}`}
                            alt={ev.ticker}
                            width={32}
                            height={32}
                            style={{ objectFit: "cover", width: "100%", height: "100%" }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <Column gap="xs" fillWidth>
                          <Row gap="s" vertical="center">
                            <Badge textVariant="label-default-s" color="brand">{ev.ticker}</Badge>
                            <Text variant="body-default-m">{ev.name}</Text>
                          </Row>
                          <Row gap="m" vertical="center" wrap>
                            {ev.hour && (
                              <Text variant="body-default-s" onBackground="neutral-weak">
                                🕐 {ev.hour}
                              </Text>
                            )}
                            <Text variant="body-default-s" onBackground="neutral-weak">
                              EPS estimado: ${ev.estimate?.toFixed(2) ?? "N/A"}
                            </Text>
                          </Row>
                        </Column>
                      </Row>
                    </Card>
                  ))}

                  {/* Legacy events */}
                  {selectedDayEvents.map((ev, i) => (
                    <Card key={`modal-legacy-${ev.symbol}-${i}`} padding="m" radius="m" fillWidth>
                      <Row gap="m" vertical="center" align="start">
                        {ev.logo && (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              overflow: "hidden",
                              background: "var(--neutral-alpha-weak)",
                              flexShrink: 0,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={ev.logo}
                              alt={ev.symbol}
                              width={32}
                              height={32}
                              style={{ objectFit: "cover", width: "100%", height: "100%" }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        )}
                        <Column gap="xs" fillWidth>
                          <Row gap="s" vertical="center" wrap>
                            <Badge textVariant="label-default-s" color={ev.type === "upcoming" ? "brand" : "neutral"}>
                              {ev.symbol}
                            </Badge>
                            <Text variant="body-default-m">{ev.name}</Text>
                            {ev.quarter && (
                              <Text variant="body-default-s" onBackground="neutral-weak">{ev.quarter}</Text>
                            )}
                          </Row>
                          <Text variant="body-default-s" onBackground="neutral-weak">
                            Est: ${ev.estimate?.toFixed(2) ?? "—"}
                            {ev.actual !== null && ev.actual !== undefined ? ` | Real: $${ev.actual.toFixed(2)}` : ""}
                            {ev.surprisePercent !== null && ev.surprisePercent !== undefined
                              ? ` | ${ev.surprisePercent >= 0 ? "+" : ""}${ev.surprisePercent.toFixed(1)}%`
                              : ""}
                          </Text>
                        </Column>
                      </Row>
                    </Card>
                  ))}
                </Column>
              )}
            </Column>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <Card padding="m" radius="m" fillWidth>
        <Row gap="l" wrap>
          <Column gap="xs">
            <Text variant="label-default-xs" onBackground="neutral-weak">Proximos eventos</Text>
            <Text variant="heading-strong-m">{events.length}</Text>
          </Column>
          <Column gap="xs">
            <Text variant="label-default-xs" onBackground="neutral-weak">Tus stocks con earnings</Text>
            <Text variant="heading-strong-m">{stockEarnings.length > 0 ? [...new Set(stockEarnings.map((e) => e.symbol))].length : 0}</Text>
          </Column>
          <Column gap="xs">
            <Text variant="label-default-xs" onBackground="neutral-weak">Reportes este mes</Text>
            <Text variant="heading-strong-m">{allMonthEarnings}</Text>
          </Column>
          <Column gap="xs">
            <Text variant="label-default-xs" onBackground="neutral-weak">Notificaciones</Text>
            <Text variant="heading-strong-m">{isSubscribed ? "ON" : "OFF"}</Text>
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
          Reportes actualizados diariamente por cron job · Logos via Clearbit · Cryptos sincronizados con Telegram
        </Text>
      </Row>
    </Column>
  );
}
