/*
 * Quartly Bot — lib/formatFinance.ts
 * Utilidades de formateo financiero
 */

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCryptoAmount(value: number, ticker: string): string {
  const decimals = value >= 1 ? 2 : 4;
  return `${value.toFixed(decimals)} ${ticker.toUpperCase()}`;
}

export function getChangeColor(value: number | null): "emerald" | "red" | "neutral" {
  if (value === null) return "neutral";
  if (value > 0) return "emerald";
  if (value < 0) return "red";
  return "neutral";
}
