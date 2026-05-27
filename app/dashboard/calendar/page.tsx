"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, Card } from "@once-ui-system/core";

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const password = localStorage.getItem("quartly_auth");
    fetch("/api/dashboard/calendar?from=" + new Date().toISOString().split("T")[0], {
      headers: { Authorization: `Bearer ${password}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEvents(data.events);
      })
      .finally(() => setLoading(false));
  }, []);

  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <Column gap="l">
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
    </Column>
  );
}
