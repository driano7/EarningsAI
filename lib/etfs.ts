/*
 * Quartly Bot — lib/etfs.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

export interface ETF {
  ticker: string;
  name: string;
  category: string;
}

export const ETFS: ETF[] = [
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", category: "US Market" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", category: "US Market" },
  { ticker: "DIA", name: "SPDR Dow Jones Industrial Average ETF", category: "US Market" },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", category: "US Market" },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", category: "US Market" },
  { ticker: "XLK", name: "Technology Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLF", name: "Financial Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLE", name: "Energy Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLV", name: "Health Care Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLC", name: "Communication Services Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLI", name: "Industrial Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLB", name: "Materials Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLRE", name: "Real Estate Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLU", name: "Utilities Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLP", name: "Consumer Staples Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund", category: "Sectores" },
  { ticker: "GLD", name: "SPDR Gold Shares", category: "Commodities" },
  { ticker: "SLV", name: "iShares Silver Trust", category: "Commodities" },
  { ticker: "USO", name: "United States Oil Fund", category: "Commodities" },
  { ticker: "GDX", name: "VanEck Gold Miners ETF", category: "Commodities" },
  { ticker: "PDBC", name: "Invesco Optimum Yield Diversified Commodity Strategy", category: "Commodities" },
  { ticker: "EWZ", name: "iShares MSCI Brazil ETF", category: "Internacional" },
  { ticker: "EWY", name: "iShares MSCI South Korea ETF", category: "Internacional" },
  { ticker: "FXI", name: "iShares China Large-Cap ETF", category: "Internacional" },
  { ticker: "EWJ", name: "iShares MSCI Japan ETF", category: "Internacional" },
  { ticker: "EWG", name: "iShares MSCI Germany ETF", category: "Internacional" },
  { ticker: "MCHI", name: "iShares MSCI China ETF", category: "Internacional" },
  { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF", category: "Internacional" },
  { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", category: "Internacional" },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", category: "Bonos" },
  { ticker: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", category: "Bonos" },
  { ticker: "LQD", name: "iShares iBoxx Investment Grade Corporate Bond ETF", category: "Bonos" },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", category: "Bonos" },
  { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", category: "Bonos" },
  { ticker: "VXX", name: "iPath Series B S&P 500 VIX Short-Term Futures ETN", category: "Volatilidad" },
  { ticker: "UVXY", name: "ProShares Ultra VIX Short-Term Futures ETF", category: "Volatilidad" },
];
