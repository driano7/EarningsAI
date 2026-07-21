"use client";

import { Column, Row, Text, Skeleton } from "@once-ui-system/core";
import { useMacroData } from "@/hooks/useMacroData";

export function MacroStrip() {
  const { data, loading, error } = useMacroData();

  if (error) {
    return null;
  }

  if (loading) {
    return (
      <Row gap="m" wrap>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} shape="block" width="l" height="l" radius="m" />
        ))}
      </Row>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Row gap="s" style={{ overflowX: "auto", paddingBottom: 4 }} wrap>
      {data.map((serie) => {
        const changeColor = serie.change !== null
          ? serie.change > 0
            ? "success-weak"
            : serie.change < 0
            ? "danger-weak"
            : "neutral-weak"
          : "neutral-weak";

        return (
          <Column
            key={serie.id}
            padding="s"
            radius="m"
            style={{
              minWidth: 120,
              flex: "0 0 auto",
              background: "var(--neutral-alpha-weak)",
              border: "1px solid var(--neutral-alpha-weak)",
            }}
            gap="xs"
          >
            <Text variant="label-default-xs" onBackground="neutral-weak">
              {serie.label}
            </Text>
            <Text variant="label-strong-m">
              {serie.value !== null ? `${serie.value.toFixed(2)} ${serie.unit}` : "—"}
            </Text>
            <Text variant="label-default-xs" onBackground={changeColor}>
              {serie.change !== null
                ? `${serie.change > 0 ? "+" : ""}${serie.change.toFixed(2)}`
                : ""}
            </Text>
          </Column>
        );
      })}
    </Row>
  );
}
