/*
 * Quartly Bot — lib/formatFinance.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
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

export function getChangeColor(value: number | null): "success" | "danger" | "neutral" {
  if (value === null) return "neutral";
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "neutral";
}
