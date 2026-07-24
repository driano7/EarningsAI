/*
 * Quartly Bot — lib/chartColors.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

export const CHART_COLORS = {
  positive:  "var(--emerald-400)",
  negative:  "var(--red-400)",
  neutral:   "var(--neutral-400)",
  brand:     "var(--cyan-400)",
  accent:    "var(--emerald-300)",
  muted:     "var(--neutral-600)",
} as const;

export const CATEGORY_PALETTE = [
  "var(--cyan-400)",
  "var(--emerald-400)",
  "var(--blue-400)",
  "var(--violet-400)",
  "var(--orange-400)",
  "var(--red-400)",
  "var(--yellow-400)",
  "var(--pink-400)",
  "var(--teal-400)",
  "var(--indigo-400)",
] as const;

export const SPARKLINE_COLOR_POSITIVE = "var(--emerald-400)";
export const SPARKLINE_COLOR_NEGATIVE = "var(--red-400)";
export const SPARKLINE_COLOR_DEFAULT  = "var(--cyan-400)";

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
  background: "rgba(255, 255, 255, 0.03)",
  backdropFilter: "blur(20px) saturate(1.5)",
  WebkitBackdropFilter: "blur(20px) saturate(1.5)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 12,
  boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.08)",
  overflow: "hidden" as const,
};
