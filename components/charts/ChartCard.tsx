"use client";

import { useRef } from "react";
import { Card, Column, Row, Text, IconButton } from "@once-ui-system/core";
import { downloadChartPng } from "@/lib/chart-utils";
import { CHART_GLASS_STYLE } from "@/lib/chartColors";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  filename?: string;
  height?: number;
}

export function ChartCard({ title, subtitle, children, filename = "chart", height = 240 }: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  return (
    <Card padding="m" radius="m" fillWidth style={CHART_GLASS_STYLE}>
      <Column gap="m">
        <Row vertical="center" horizontal="between" fillWidth>
          <Column gap="xs">
            <Text variant="body-default-m" onBackground="brand-weak">
              {title}
            </Text>
            {subtitle && (
              <Text variant="body-default-s" onBackground="neutral-weak">
                {subtitle}
              </Text>
            )}
          </Column>
          <IconButton
            icon="download"
            onClick={() => downloadChartPng(chartRef.current, filename)}
            size="s"
            variant="tertiary"
            tooltip="Descargar PNG"
          />
        </Row>
        <div ref={chartRef} style={{ width: "100%", height }}>
          {children}
        </div>
      </Column>
    </Card>
  );
}
