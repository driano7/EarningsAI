/*
 * Quartly Bot — app/dashboard/superinversores/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, Card, Skeleton, Icon, Button } from "@once-ui-system/core";
import { formatSuperInvestorsForTelegram } from "@/lib/daily-cache";

export default function SuperinversoresPage() {
  const [data, setData] = useState<{ changes: any[]; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/superinversores")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
        } else {
          setError(d.error || "Error cargando datos");
        }
      })
      .catch(() => setError("Error de conexión"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Column gap="m" padding="l">
        <Heading variant="heading-strong-xl">🏛 Superinversores</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Movimientos 13F de Berkshire, Pershing Square y Duquesne
        </Text>
        <Card padding="l" radius="l">
          <Skeleton shape="block" height="xl" fillWidth radius="m" />
        </Card>
      </Column>
    );
  }

  if (error || !data) {
    return (
      <Column gap="m" padding="l">
        <Heading variant="heading-strong-xl">🏛 Superinversores</Heading>
        <Card padding="l" radius="l" background="danger-alpha-weak" border="danger-medium">
          <Text variant="body-default-m" onBackground="danger-medium">
            ⚠️ {error || "No se pudieron cargar los datos"}
          </Text>
          <Button variant="primary" size="s" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>
            Reintentar
          </Button>
        </Card>
      </Column>
    );
  }

  return (
    <Column gap="l" padding="l" style={{ maxWidth: 900, margin: "0 auto" }}>
      <Row gap="m" vertical="center" horizontal="between" wrap>
        <Column gap="xs">
          <Heading variant="heading-strong-xl">🏛 Superinversores (13F)</Heading>
          <Text variant="body-default-l" onBackground="neutral-weak">
            Movimientos de {data.changes.length} grandes capitales — Trimestre: {data.date}
          </Text>
        </Column>
        <Badge background="brand-alpha-medium" onBackground="brand-strong">
          Datos: SEC EDGAR
        </Badge>
      </Row>

      {data.changes.map((investor) => (
        <Card key={investor.investor} padding="l" radius="l" border="neutral-alpha-weak" gap="m">
          <Row gap="s" vertical="center" horizontal="between" wrap>
            <Column gap="xs">
              <Row gap="s" vertical="center" wrap>
                <Badge textVariant="label-default-s" color={investor.investor.includes("Berkshire") ? "brand" : investor.investor.includes("Pershing") ? "accent" : "success"}>
                  {investor.investor}
                </Badge>
                <Text variant="label-default-s" onBackground="neutral-weak">
                  {investor.investorName === "Berkshire Hathaway" && "S&P 500 / Value & Calidad"}
                  {investor.investorName === "Pershing Square (Bill Ackman)" && "Nasdaq / Big Tech / Concentrado"}
                  {investor.investorName === "Duquesne Family Office (Stanley Druckenmiller)" && "Semiconductores / IA / Macrotendencias"}
                </Text>
              </Row>
              <Text variant="body-default-xs" onBackground="neutral-weak">
                Filed: {new Date(investor.filedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </Text>
            </Column>
          </Row>

          <Column gap="l">
            {investor.topNew.length > 0 && (
              <Column gap="xs">
                <Row gap="s" vertical="center">
                  <Icon name="plusCircle" size="s" style={{ color: "var(--success-medium)" }} />
                  <Text variant="label-strong-s" style={{ color: "var(--success-medium)" }}>NUEVAS POSICIONES</Text>
                </Row>
                {investor.topNew.map((h: any) => (
                  <Row gap="m" vertical="center" key={`${h.ticker}-new`} style={{ paddingLeft: 20 }}>
                    <Text variant="body-default-m" style={{ fontWeight: 600, minWidth: 80 }}>{h.ticker}</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak" style={{ flex: 1 }}>{h.name}</Text>
                    <Text variant="label-strong-s" style={{ color: "var(--success-medium)" }}>+{h.changePct.toFixed(1)}%</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">{h.currShares.toLocaleString()} acciones</Text>
                    <Text variant="body-default-s" style={{ color: "var(--success-medium)", fontWeight: 500 }}>${(h.currValue / 1e6).toFixed(1)}M</Text>
                  </Row>
                ))}
              </Column>
            )}

            {investor.topIncreased.length > 0 && (
              <Column gap="xs">
                <Row gap="s" vertical="center">
                  <Icon name="trendingUp" size="s" style={{ color: "var(--brand-strong)" }} />
                  <Text variant="label-strong-s" style={{ color: "var(--brand-strong)" }}>AUMENTADAS</Text>
                </Row>
                {investor.topIncreased.map((h: any) => (
                  <Row gap="m" vertical="center" key={`${h.ticker}-inc`} style={{ paddingLeft: 20 }}>
                    <Text variant="body-default-m" style={{ fontWeight: 600, minWidth: 80 }}>{h.ticker}</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak" style={{ flex: 1 }}>{h.name}</Text>
                    <Text variant="label-strong-s" style={{ color: "var(--brand-strong)" }}>+{h.changePct.toFixed(1)}%</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">{h.currShares.toLocaleString()} acciones</Text>
                    <Text variant="body-default-s" style={{ color: "var(--brand-strong)", fontWeight: 500 }}>${(h.currValue / 1e6).toFixed(1)}M</Text>
                  </Row>
                ))}
              </Column>
            )}

            {investor.topDecreased.length > 0 && (
              <Column gap="xs">
                <Row gap="s" vertical="center">
                  <Icon name="trendingDown" size="s" style={{ color: "var(--danger-medium)" }} />
                  <Text variant="label-strong-s" style={{ color: "var(--danger-medium)" }}>REDUCIDAS</Text>
                </Row>
                {investor.topDecreased.map((h: any) => (
                  <Row gap="m" vertical="center" key={`${h.ticker}-dec`} style={{ paddingLeft: 20 }}>
                    <Text variant="body-default-m" style={{ fontWeight: 600, minWidth: 80 }}>{h.ticker}</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak" style={{ flex: 1 }}>{h.name}</Text>
                    <Text variant="label-strong-s" style={{ color: "var(--danger-medium)" }}>{h.changePct.toFixed(1)}%</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">{h.currShares.toLocaleString()} acciones</Text>
                    <Text variant="body-default-s" style={{ color: "var(--danger-medium)", fontWeight: 500 }}>${(h.currValue / 1e6).toFixed(1)}M</Text>
                  </Row>
                ))}
              </Column>
            )}

            {investor.topSoldOut.length > 0 && (
              <Column gap="xs">
                <Row gap="s" vertical="center">
                  <Icon name="xCircle" size="s" style={{ color: "var(--neutral-on-background-weak)" }} />
                  <Text variant="label-strong-s" style={{ color: "var(--neutral-on-background-weak)" }}>SALIDA TOTAL</Text>
                </Row>
                {investor.topSoldOut.map((h: any) => (
                  <Row gap="m" vertical="center" key={`${h.ticker}-sold`} style={{ paddingLeft: 20 }}>
                    <Text variant="body-default-m" style={{ fontWeight: 600, minWidth: 80 }}>{h.ticker}</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak" style={{ flex: 1 }}>{h.name}</Text>
                    <Text variant="label-strong-s" style={{ color: "var(--neutral-on-background-weak)" }}>Vendido todo</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">{h.prevShares.toLocaleString()} eran</Text>
                  </Row>
                ))}
              </Column>
            )}

            {(investor.topNew.length === 0 && investor.topIncreased.length === 0 && investor.topDecreased.length === 0 && investor.topSoldOut.length === 0) && (
              <Text variant="body-default-s" onBackground="neutral-weak" style={{ textAlign: "center", padding: "16px" }}>
                Sin movimientos destacados este trimestre
              </Text>
            )}
          </Column>
        </Card>
      ))}

      <Text variant="label-default-xs" onBackground="neutral-weak" style={{ textAlign: "center", marginTop: 24 }}>
        📊 Datos actualizados cada trimestre (45 días después del cierre) · Fuente: SEC EDGAR Form 13F-HR
      </Text>
    </Column>
  );
}