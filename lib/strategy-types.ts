export type AssetType = "stock" | "etf" | "crypto";
export type Interval = "1d" | "1h" | "4h" | "1w";

export interface IndicatorConfig {
  type: "EMA" | "SMA" | "RSI" | "MACD" | "VWAP" | "ATR" | "BB" | "VOLUME";
  params: { period?: number; [key: string]: number | undefined };
  color: string;   // hex, e.g. "#2196F3"
  panel: "main" | "sub";
}

export interface StrategyRule {
  left: string;    // e.g. "EMA_20", "RSI_14", "VOLUME"
  operator: ">" | "<" | ">=" | "<=" | "crosses_above" | "crosses_below";
  right: string;   // e.g. "EMA_50", "70", "VOLUME_SMA_20"
}

export interface StrategyJSON {
  indicators: IndicatorConfig[];
  entry_rules: StrategyRule[];
  exit_rules: StrategyRule[];
}

export interface OHLCVBar {
  time: number;   // Unix timestamp seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalPoint {
  time: number;
  type: "buy" | "sell";
  price: number;
  reason: string;
}

export interface ChartSeries {
  name: string;    // e.g. "EMA_20"
  color: string;   // hex
  panel: "main" | "sub";
  data: { time: number; value: number }[];
}

export interface StrategyResult {
  ohlcv: OHLCVBar[];
  series: ChartSeries[];
  signals: SignalPoint[];
}

// Saved strategy stored in Vercel KV
export interface SavedStrategy {
  id: string;           // nanoid, e.g. "str_abc123"
  name: string;         // user-defined name e.g. "EMA Cross BTC"
  prompt: string;       // original natural language prompt
  json: StrategyJSON;   // parsed strategy
  ticker: string;
  assetType: AssetType;
  interval: Interval;
  createdAt: string;    // ISO string
  updatedAt: string;
}