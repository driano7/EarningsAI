/*
 * Quartly Bot — lib/custom-tickers.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

export interface CustomTicker {
  ticker: string;
  name: string;
  sector: string;
  isEtf: boolean;
}

export const CUSTOM_TICKERS: CustomTicker[] = [
  { ticker: "TSM", name: "Taiwan Semiconductor Manufacturing", sector: "Information Technology", isEtf: false },
  { ticker: "ASML", name: "ASML Holding", sector: "Information Technology", isEtf: false },
  { ticker: "SAP", name: "SAP SE", sector: "Information Technology", isEtf: false },
  { ticker: "NVO", name: "Novo Nordisk", sector: "Health Care", isEtf: false },
  { ticker: "SHOP", name: "Shopify", sector: "Information Technology", isEtf: false },
];
