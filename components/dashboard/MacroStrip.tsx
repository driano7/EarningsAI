"use client";

import { useState } from "react";
import { Column, Row, Text, Skeleton } from "@once-ui-system/core";
import { useMacroData } from "@/hooks/useMacroData";
import { MacroChart } from "./MacroChart";

export function MacroStrip() {
  const { data, loading, error } = useMacroData();
  const [selected, setSelected] = useState<{ id: string; label: string; unit: string } | null>(null);

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
    <Column gap="m" fillWidth>
      <Row gap="s" style={{ overflowX: "auto", paddingBottom: 4 }} wrap>
        {data.map((serie) => {
          const changeColor = serie.change !== null
            ? serie.change > 0
              ? "success-weak"
              : serie.change < 0
              ? "danger-weak"
              : "neutral-weak"
            : "neutral-weak";

          const isSelected = selected?.id === serie.id;

          return (
            <Column
              key={serie.id}
              padding="s"
              radius="m"
              style={{
                minWidth: 120,
                flex: "0 0 auto",
                background: isSelected ? "var(--brand-alpha-weak)" : "var(--neutral-alpha-weak)",
                border: isSelected ? "1px solid var(--brand-strong)" : "1px solid var(--neutral-alpha-weak)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              gap="xs"
              onClick={() => setSelected(isSelected ? null : { id: serie.id, label: serie.label, unit: serie.unit })}
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

      {selected && (
        <MacroChart
          seriesId={selected.id}
          label={selected.label}
          unit={selected.unit}
          onClose={() => setSelected(null)}
        />
      )}
    </Column>
  );
}
