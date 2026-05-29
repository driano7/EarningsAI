export interface CryptoQuote {
  ticker: string;
  name: string;
  priceUsd: number;
  change24h: number | null;
  change7d: number | null;
  marketCapUsd: number | null;
}

export interface CryptoHistory {
  ticker: string;
  prices: Array<[number, number]>;
}

export type PositionType = "stock" | "etf" | "crypto" | "sofipo" | "cetes";

export interface PortfolioPosition {
  id: string;
  chatId: string;
  ticker: string;
  type: PositionType;
  buyPrice: number;
  quantity: number;
  buyDate: string;
  notes?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  chatId: string;
  ticker: string;
  type: "buy" | "sell";
  price: number;
  quantity: number;
  date: string;
  notes?: string;
}

export type PaymentNetwork =
  | "bitcoin"
  | "lightning"
  | "ethereum"
  | "arbitrum"
  | "optimism"
  | "linea"
  | "zksync"
  | "avalanche"
  | "solana";

export type PaymentAsset =
  | "BTC"
  | "ETH"
  | "USDC"
  | "USDT"
  | "SOL";

export interface CryptoPaymentAddress {
  id: string;
  chatId: string;
  asset: PaymentAsset;
  network: PaymentNetwork;
  address: string;
  label?: string;
  active: boolean;
  createdAt: string;
}

export interface PaymentInvoice {
  id: string;
  chatId: string;
  asset: PaymentAsset;
  network: PaymentNetwork;
  address: string;
  amount?: number;
  amountFiat?: number;
  fiatCurrency?: string;
  status: "pending" | "completed" | "expired" | "failed";
  description?: string;
  txHash?: string;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
}
