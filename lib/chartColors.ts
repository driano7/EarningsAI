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
