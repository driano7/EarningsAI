/*
 * Quartly Bot — components/dashboard/EarningsCalendar.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useMemo } from "react";
import { Column, Row, Flex, Text, Input } from "@once-ui-system/core";

interface EarningsEvent {
  ticker: string;
  date: string;
  fiscalQuarter: string;
  epsEstimate?: number;
  revenueEstimate?: number;
}

interface EarningsCalendarProps {
  events: EarningsEvent[];
}

export default function EarningsCalendar({ events }: EarningsCalendarProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const thisWeekEvents = events.filter((e) => {
      const d = new Date(e.date);
      return d >= startOfWeek && d <= endOfWeek;
    });

    const nextWeekEvents = events.filter((e) => {
      const d = new Date(e.date);
      const nextStart = new Date(startOfWeek);
      nextStart.setDate(startOfWeek.getDate() + 7);
      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextStart.getDate() + 6);
      return d >= nextStart && d <= nextEnd;
    });

    return { thisWeek: thisWeekEvents, nextWeek: nextWeekEvents };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!filter.trim()) return events;
    const q = filter.toUpperCase();
    return events.filter((e) => e.ticker.toUpperCase().includes(q));
  }, [events, filter]);

  const now = new Date();
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  function groupByDate(evts: EarningsEvent[]) {
    const map = new Map<string, EarningsEvent[]>();
    evts.forEach((e) => {
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    });
    return map;
  }

  function renderDayRow(dateKey: string, dayEvents: EarningsEvent[]) {
    const d = new Date(dateKey);
    const dayName = dayNames[d.getDay()];
    const isToday = dateKey === now.toISOString().split("T")[0];
    const isPast = dateKey < now.toISOString().split("T")[0];

    return (
      <Flex
        key={dateKey}
        fillWidth
        gap="m"
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--neutral-alpha-weak)",
          opacity: isPast ? 0.5 : 1,
          background: isToday ? "var(--brand-alpha-weak)" : undefined,
          borderRadius: isToday ? 8 : 0,
        }}
      >
        <Flex fillWidth={false} style={{ minWidth: 80, flexDirection: "column" }} gap="xs">
          <Text variant="body-default-xs" style={{ textTransform: "uppercase", fontWeight: 600 }}>
            {dayName}
          </Text>
          <Text variant="body-default-m" style={{ fontWeight: 600 }}>
            {d.getDate()} {monthNames[d.getMonth()]}
          </Text>
        </Flex>
        <Flex wrap gap="s">
          {dayEvents.map((evt) => (
            <div
              key={`${evt.ticker}-${evt.fiscalQuarter}`}
              className="liquid-glass-sm"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--neutral-surface)",
                border: "1px solid var(--neutral-alpha-medium)",
              }}
            >
              <Text variant="body-default-m" style={{ fontWeight: 600 }}>{evt.ticker}</Text>
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {evt.fiscalQuarter}
              </Text>
              {evt.epsEstimate && (
                <Text variant="body-default-xs">
                  EPS est: ${evt.epsEstimate.toFixed(2)}
                </Text>
              )}
            </div>
          ))}
        </Flex>
      </Flex>
    );
  }

  function renderWeek(weekEvents: EarningsEvent[], label: string) {
    const grouped = groupByDate(weekEvents);
    const sortedDates = Array.from(grouped.keys()).sort();

    if (sortedDates.length === 0) {
      return (
        <Text variant="body-default-s" onBackground="neutral-weak">
          No hay eventos esta {label.toLowerCase()}.
        </Text>
      );
    }

    return (
      <Column gap="xs">
        {sortedDates.map((date) => renderDayRow(date, grouped.get(date)!))}
      </Column>
    );
  }

  return (
    <Column gap="l">
      <Row vertical="center" horizontal="between" wrap gap="m">
        <Column gap="xs">
          <Text variant="body-default-xs" onBackground="neutral-weak">Filtrar ticker</Text>
          <Input
            id="earnings-filter"
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            placeholder="AAPL, TSLA..."
            style={{ minWidth: 160 }}
          />
        </Column>
      </Row>

      {filter.trim() ? (
        <Column gap="l">
          <Column gap="s">
            <Text variant="heading-strong-m">Resultados</Text>
            {(() => {
              const grouped = groupByDate(filteredEvents);
              const sorted = Array.from(grouped.keys()).sort();
              if (sorted.length === 0) {
                return <Text onBackground="neutral-weak">Sin resultados.</Text>;
              }
              return (
                <Column gap="xs">
                  {sorted.map((date) => renderDayRow(date, grouped.get(date)!))}
                </Column>
              );
            })()}
          </Column>
        </Column>
      ) : (
        <Column gap="xl">
          <Column gap="s">
            <Text variant="heading-strong-m">Esta semana</Text>
            {renderWeek(filtered.thisWeek, "semana")}
          </Column>
          <Column gap="s">
            <Text variant="heading-strong-m">Próxima semana</Text>
            {renderWeek(filtered.nextWeek, "próxima semana")}
          </Column>
        </Column>
      )}
    </Column>
  );
}
