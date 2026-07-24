/*
 * Quartly Bot — components/dashboard/AnalystSignal.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { Flex, Text } from "@once-ui-system/core";

interface AnalystSignalProps {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export default function AnalystSignal({ strongBuy, buy, hold, sell, strongSell }: AnalystSignalProps) {
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) {
    return (
      <Flex vertical="center" gap="s">
        <Text variant="body-default-s" onBackground="neutral-weak">🎯 Sin datos de analistas</Text>
      </Flex>
    );
  }

  const bars = [
    { label: "Compra fuerte", value: strongBuy, color: "var(--success-medium)" },
    { label: "Compra", value: buy, color: "var(--success-weak)" },
    { label: "Mantener", value: hold, color: "var(--warning-medium)" },
    { label: "Vende", value: sell, color: "var(--danger-weak)" },
    { label: "Vende fuerte", value: strongSell, color: "var(--danger-medium)" },
  ].filter((b) => b.value > 0);

  return (
    <Flex vertical="center" gap="s" fillWidth>
      <Flex fillWidth gap="xs" style={{ height: 8 }}>
        {bars.map((b) => (
          <Flex
            key={b.label}
            style={{
              width: `${(b.value / total) * 100}%`,
              height: "100%",
              backgroundColor: b.color,
              borderRadius: 4,
              transition: "width 0.3s ease",
            }}
          />
        ))}
      </Flex>
      <Flex wrap gap="s" vertical="center">
        {bars.map((b) => (
          <Flex key={b.label} vertical="center" gap="xs">
            <Flex
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: b.color,
              }}
            />
            <Text variant="body-default-xs" onBackground="neutral-weak">
              {b.label}: {((b.value / total) * 100).toFixed(1)}%
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
