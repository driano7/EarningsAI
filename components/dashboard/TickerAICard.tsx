"use client";

import { useState, useEffect } from "react";
import { Column, Row, Text, Badge, ProgressBar, Skeleton } from "@once-ui-system/core";
import type { TickerAnalysis } from "@/lib/ai-analysis";

const VERDICT_COLORS: Record<string, "success-strong" | "danger-strong" | "warning-strong" | "neutral-strong"> = {
  COMPRAR: "success-strong",
  VENDER: "danger-strong",
  MANTENER: "warning-strong",
  OBSERVAR: "neutral-strong",
};

interface Props {
  ticker: string;
  chatId: string;
}

export function TickerAICard({ ticker, chatId }: Props) {
  const [analysis, setAnalysis] = useState<TickerAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/ai/ticker?chatId=${chatId}&ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.analysis) {
          setAnalysis(data.analysis);
        } else if (data.error === "quota_exceeded") {
          setError("quota_exceeded");
        } else {
          setError("not_found");
        }
      })
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [ticker, chatId]);

  if (loading) {
    return <Skeleton shape="block" height="l" fillWidth radius="m" />;
  }

  if (error === "quota_exceeded") {
    return (
      <Badge solid="warning-weak" textVariant="label-default-s" fillWidth>
        Cuota diaria agotada — Análisis AI no disponible
      </Badge>
    );
  }

  if (error === "not_found" || !analysis) {
    return null;
  }

  return (
    <Column
      fillWidth
      padding="m"
      radius="m"
      gap="s"
      style={{
        background: "var(--neutral-alpha-weak)",
        border: "1px solid var(--neutral-alpha-weak)",
      }}
    >
      <Row gap="s" vertical="center" horizontal="between">
        <Text variant="label-strong-s">Análisis AI · {ticker}</Text>
        {analysis.verdict && (
          <Badge solid={VERDICT_COLORS[analysis.verdict] ?? "neutral-strong"} textVariant="label-default-xs">
            {analysis.verdict}
          </Badge>
        )}
      </Row>

      <Text variant="body-default-s">{analysis.summary}</Text>

      {analysis.catalysts.length > 0 && (
        <Column gap="xs">
          <Text variant="label-default-xs" onBackground="success-medium">Catalizadores</Text>
          {analysis.catalysts.map((c, i) => (
            <Row key={i} gap="xs" vertical="center">
              <Text variant="label-default-xs" onBackground="success-medium">▸</Text>
              <Text variant="body-default-xs">{c}</Text>
            </Row>
          ))}
        </Column>
      )}

      {analysis.risks.length > 0 && (
        <Column gap="xs">
          <Text variant="label-default-xs" onBackground="danger-medium">Riesgos</Text>
          {analysis.risks.map((r, i) => (
            <Row key={i} gap="xs" vertical="center">
              <Text variant="label-default-xs" onBackground="danger-medium">▸</Text>
              <Text variant="body-default-xs">{r}</Text>
            </Row>
          ))}
        </Column>
      )}

      <Column gap="xs">
        <Row gap="s" vertical="center" horizontal="between">
          <Text variant="label-default-xs" onBackground="neutral-weak">Confianza</Text>
          <Text variant="label-default-xs">{analysis.confidence}%</Text>
        </Row>
        <ProgressBar value={analysis.confidence} barBackground={analysis.confidence >= 70 ? "success-medium" : analysis.confidence >= 40 ? "warning-medium" : "danger-medium"} />
      </Column>
    </Column>
  );
}
