/*
 * Quartly Bot — components/dashboard/PriceChange.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { Flex, Text } from "@once-ui-system/core";

interface PriceChangeProps {
  value: number | null;
  label: string;
}

export default function PriceChange({ value, label }: PriceChangeProps) {
  if (value === null) {
    return (
      <Flex vertical="center" gap="xs">
        <Text variant="body-default-xs" onBackground="neutral-weak">{label}</Text>
        <Text variant="body-default-s" onBackground="neutral-weak">—</Text>
      </Flex>
    );
  }

  const isPositive = value >= 0;
  const arrow = isPositive ? "↑" : "↓";
  const color = isPositive ? "#00D084" : "#FF4D4D";

  return (
    <Flex vertical="center" gap="xs">
      <Text variant="body-default-xs" onBackground="neutral-weak">{label}</Text>
      <Flex vertical="center" gap="xs" style={{ color }}>
        <Text variant="body-default-s" style={{ color, fontWeight: 600 }}>
          {arrow} {Math.abs(value).toFixed(2)}%
        </Text>
      </Flex>
    </Flex>
  );
}
