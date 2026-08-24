/*
 * Quartly Bot — lib/chartColors.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

export const CHART_COLORS = {
  positive:  "#34d399",
  negative:  "#f87171",
  neutral:   "#a1a1aa",
  brand:     "#22d3ee",
  accent:    "#6ee7b7",
  muted:     "#52525b",
} as const;

export const CATEGORY_PALETTE = [
  "#22d3ee",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#fb923c",
  "#f87171",
  "#facc15",
  "#f472b6",
  "#2dd4bf",
  "#818cf8",
] as const;

export const SPARKLINE_COLOR_POSITIVE = "#34d399";
export const SPARKLINE_COLOR_NEGATIVE = "#f87171";
export const SPARKLINE_COLOR_DEFAULT  = "#22d3ee";

export function getChartLineColor(change: number | null): string {
  if (change === null) return CHART_COLORS.brand;
  return change >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative;
}

export function getOnceUiColor(change: number | null): "success" | "danger" | "neutral" {
  if (change === null) return "neutral";
  return change > 0 ? "success" : change < 0 ? "danger" : "neutral";
}

const BAR_HUES = [170, 210, 260, 310, 30, 140, 200, 340, 50, 280, 100, 320];

export function getRandomBarColor(index: number): string {
  const hue = BAR_HUES[index % BAR_HUES.length];
  return `hsl(${hue}, 70%, 60%)`;
}

export function getRandomBarGradient(index: number): { start: string; end: string } {
  const hue = BAR_HUES[index % BAR_HUES.length];
  return {
    start: `hsl(${hue}, 75%, 55%)`,
    end: `hsl(${hue}, 65%, 40%)`,
  };
}

export const CHART_GLASS_STYLE = {
  background: "var(--neutral-background)",
  border: "1px solid var(--neutral-alpha-medium)",
  borderRadius: 12,
  overflow: "hidden" as const,
};
