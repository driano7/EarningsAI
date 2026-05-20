/*
 * Quartly Bot — lib/price.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

export interface PriceData {
  current: number;
  change1d: number | null;
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  change1y: number | null;
  high52w: number | null;
  low52w: number | null;
}

export function formatPriceBlock(ticker: string, name: string, sectorOrCategory: string, price: PriceData): string {
  const fmt = (v: number | null): string => {
    if (v === null) return "N/A";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}%`;
  };

  const currentStr = price.current > 0 ? `$${price.current.toFixed(2)} USD` : "N/A";
  const rangeStr =
    price.high52w !== null && price.low52w !== null
      ? `$${price.low52w.toFixed(2)} — $${price.high52w.toFixed(2)}`
      : "N/A";

  return `💹 *${ticker}* — ${name} (${sectorOrCategory})
Precio actual: ${currentStr}
📉 Variación de precio:
-  Hoy:      ${fmt(price.change1d)}
-  1 semana:  ${fmt(price.change1w)}
-  1 mes:    ${fmt(price.change1m)}
-  3 meses:  ${fmt(price.change3m)}
-  1 año:    ${fmt(price.change1y)}
📊 Rango 52 semanas: ${rangeStr}`;
}
