"use client";

import { Column, Row, Text, Badge, Icon } from "@once-ui-system/core";
import { getOnceUiColor } from "@/lib/chartColors";

interface EarningsCardProps {
  symbol: string;
  name?: string;
  date: string;
  hour?: string;
  estimate?: number;
  actual?: number | null;
  surprisePercent?: number | null;
  quarter?: string;
  type: "upcoming" | "past";
  onClick?: () => void;
}

function getSurpriseBg(color: "emerald" | "red" | "neutral") {
  if (color === "emerald") return "success-alpha-weak" as const;
  if (color === "red") return "danger-alpha-weak" as const;
  return "neutral-alpha-weak" as const;
}

function getSurpriseOnBg(color: "emerald" | "red" | "neutral") {
  if (color === "emerald") return "success-medium" as const;
  if (color === "red") return "danger-medium" as const;
  return "neutral-medium" as const;
}

export function EarningsCard({
  symbol, name, date, hour, estimate, actual, surprisePercent, quarter, type, onClick,
}: EarningsCardProps) {
  const surpriseColor = getOnceUiColor(surprisePercent ?? null);
  const isReported = type === "past" && actual !== null && actual !== undefined;

  return (
    <Column
      padding="16"
      background="surface"
      border="neutral-alpha-weak"
      radius="l"
      gap="8"
      fillWidth
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <Row fillWidth horizontal="between" vertical="center">
        <Row gap="8" vertical="center">
          <Text variant="label-strong-m">{symbol}</Text>
          {quarter && (
            <Badge
              background="neutral-alpha-weak"
              onBackground="neutral-weak"
              paddingX="xs" paddingY="xs"
            >
              <Text variant="label-default-xs">{quarter}</Text>
            </Badge>
          )}
        </Row>
        <Badge
          background={type === "upcoming" ? "brand-alpha-weak" : getSurpriseBg(surpriseColor)}
          onBackground={type === "upcoming" ? "brand-medium" : getSurpriseOnBg(surpriseColor)}
          paddingX="s" paddingY="xs"
        >
          <Text variant="label-default-xs">
            {type === "upcoming" ? "Próximo" : isReported ? "Reportó" : "Pendiente"}
          </Text>
        </Badge>
      </Row>

      {name && (
        <Text variant="label-default-xs" onBackground="neutral-weak">
          {name}
        </Text>
      )}

      <Row gap="8" vertical="center">
        <Icon name="calendar" size="xs" onBackground="neutral-weak" />
        <Text variant="label-default-xs" onBackground="neutral-weak">
          {date}{hour ? ` · ${hour === "amc" ? "Después del cierre" : hour === "bmo" ? "Antes de apertura" : hour}` : ""}
        </Text>
      </Row>

      {(estimate !== undefined || actual !== null) && (
        <Row gap="16" vertical="center" wrap>
          {estimate !== undefined && (
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Estimado</Text>
              <Text variant="label-strong-s">${estimate.toFixed(2)}</Text>
            </Column>
          )}
          {isReported && (
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Real</Text>
              <Text
                variant="label-strong-s"
                onBackground={surprisePercent !== null && surprisePercent !== undefined
                  ? surprisePercent >= 0 ? "success-medium" : "danger-medium"
                  : "neutral-strong"
                }
              >
                ${actual!.toFixed(2)}
              </Text>
            </Column>
          )}
          {surprisePercent !== null && surprisePercent !== undefined && isReported && (
            <Column gap="xs">
              <Text variant="label-default-xs" onBackground="neutral-weak">Surprise</Text>
              <Text
                variant="label-strong-s"
                onBackground={surprisePercent >= 0 ? "success-medium" : "danger-medium"}
              >
                {surprisePercent >= 0 ? "+" : ""}{surprisePercent.toFixed(1)}%
              </Text>
            </Column>
          )}
        </Row>
      )}
    </Column>
  );
}
