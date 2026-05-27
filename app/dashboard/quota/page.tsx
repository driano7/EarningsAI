"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, Button, Card } from "@once-ui-system/core";

interface QuotaData {
  used: number;
  remaining: number;
  total: number;
  resetDate: string;
}

export default function QuotaPage() {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  function loadQuota() {
    const password = localStorage.getItem("quartly_auth");
    fetch("/api/dashboard/quota", {
      headers: { Authorization: `Bearer ${password}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setQuota(data.quota);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadQuota();
  }, []);

  async function handleReset() {
    if (!confirm("¿Resetear la cuota diaria de OpenRouter?")) return;
    setResetting(true);
    const password = localStorage.getItem("quartly_auth");
    await fetch("/api/dashboard/quota", {
      method: "POST",
      headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    loadQuota();
    setResetting(false);
  }

  const usedPercent = quota ? (quota.used / quota.total) * 100 : 0;

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Cuota de IA</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          OpenRouter — llama-4-maverick:free (límite 25/día)
        </Text>
      </Column>

      <Card padding="xl" radius="m" className="glass-card" maxWidth="m">
        {quota ? (
          <Column gap="l">
            <Row gap="l" vertical="center" wrap>
              <Column gap="xs" horizontal="center">
                <Heading variant="display-strong-l">{quota.remaining}</Heading>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  Restantes
                </Text>
              </Column>
              <Column gap="xs" horizontal="center">
                <Heading variant="display-strong-l">{quota.used}</Heading>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  Usados
                </Text>
              </Column>
              <Column gap="xs" horizontal="center">
                <Heading variant="display-strong-l">{quota.total}</Heading>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  Total
                </Text>
              </Column>
            </Row>

            <Column gap="s">
              <Row gap="s" vertical="center">
                <Text variant="body-default-s">Progreso:</Text>
                <Badge
                  textVariant="label-default-s"
                  color={usedPercent >= 100 ? "danger" : usedPercent > 75 ? "accent" : "brand"}
                >
                  {usedPercent.toFixed(0)}%
                </Badge>
              </Row>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  borderRadius: 4,
                  background: "var(--neutral-alpha-weak)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(usedPercent, 100)}%`,
                    height: "100%",
                    background: usedPercent >= 100
                      ? "var(--danger-on-background-strong)"
                      : usedPercent > 75
                      ? "var(--accent-on-background-strong)"
                      : "var(--brand-on-background-strong)",
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </Column>

            <Text variant="body-default-s" onBackground="neutral-weak">
              Se resetea: {quota.resetDate}
            </Text>

            <Button onClick={handleReset} disabled={resetting} variant="secondary">
              {resetting ? "Reseteando..." : "Resetear cuota"}
            </Button>
          </Column>
        ) : (
          <Text>{loading ? "Cargando..." : "Error al cargar cuota"}</Text>
        )}
      </Card>
    </Column>
  );
}
