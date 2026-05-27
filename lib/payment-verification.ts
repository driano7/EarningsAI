/*
 * Quartly Bot — lib/payment-verification.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 *
 * Read-only blockchain verification via public APIs.
 * No private keys are used — we only check incoming tx to our addresses.
 */

import type { PaymentAsset, PaymentNetwork } from "./types";
export type { PaymentAsset, PaymentNetwork };

export interface VerificationResult {
  confirmed: boolean;
  txHash?: string;
  confirmations?: number;
  amount?: number;
  fromAddress?: string;
}

/* ─── BTC on-chain ─────────────────────────────────────────── */

async function verifyBtcOnChain(address: string, expectedAmount?: number): Promise<VerificationResult> {
  const res = await fetch(`https://mempool.space/api/address/${address}/txs`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { confirmed: false };

  const txs: Array<{
    txid: string;
    status: { confirmed: boolean; block_height?: number };
    vout: Array<{ value: number; scriptpubkey_address: string }>;
  }> = await res.json();

  for (const tx of txs) {
    const received = tx.vout
      .filter((o) => o.scriptpubkey_address === address)
      .reduce((sum, o) => sum + o.value, 0);

    if (received > 0) {
      const amountBtc = received / 1e8;
      if (expectedAmount === undefined || Math.abs(amountBtc - expectedAmount) < 0.0001) {
        return {
          confirmed: tx.status.confirmed,
          txHash: tx.txid,
          confirmations: tx.status.confirmed ? (tx.status.block_height ? 6 : 1) : 0,
          amount: amountBtc,
        };
      }
    }
  }

  return { confirmed: false };
}

/* ─── Lightning ────────────────────────────────────────────── */
/* Lightning payments require an LNBits / LND hub to verify.
   For now we show the invoice and mark as pending. */

async function verifyLightning(address: string): Promise<VerificationResult> {
  return { confirmed: false };
}

/* ─── EVM chains (Ethereum, Arbitrum, Optimism, Linea, zkSync, Avalanche) ── */

const ETHERSCAN_API = "https://api.etherscan.io/api";
const ARBISCAN_API = "https://api.arbiscan.io/api";
const OPTIMISTIC_ETHERSCAN = "https://api-optimistic.etherscan.io/api";
const LINEASCAN = "https://api.lineascan.build/api";
const ZKSYNC_API = "https://block-explorer-api.mainnet.zksync.io";
const SNOWTRACE = "https://api.snowtrace.io/api";

const BLOCKCHAIN_CENTER = "https://api.blockchaincenter.com/v1/tx";

interface EvmConfig {
  apiUrl: string;
  apiKey: string;
}

function getEvmConfig(network: PaymentNetwork): EvmConfig {
  switch (network) {
    case "ethereum":
      return { apiUrl: ETHERSCAN_API, apiKey: process.env.ETHERSCAN_API_KEY || "" };
    case "arbitrum":
      return { apiUrl: ARBISCAN_API, apiKey: process.env.ARBISCAN_API_KEY || "" };
    case "optimism":
      return { apiUrl: OPTIMISTIC_ETHERSCAN, apiKey: process.env.OPTIMISTIC_API_KEY || "" };
    case "linea":
      return { apiUrl: LINEASCAN, apiKey: process.env.LINEASCAN_API_KEY || "" };
    case "zksync":
      return { apiUrl: ZKSYNC_API, apiKey: "" };
    case "avalanche":
      return { apiUrl: SNOWTRACE, apiKey: process.env.SNOWTRACE_API_KEY || "" };
    default:
      return { apiUrl: ETHERSCAN_API, apiKey: "" };
  }
}

async function verifyEvm(
  address: string,
  network: PaymentNetwork,
  expectedAmount?: number,
  asset?: PaymentAsset
): Promise<VerificationResult> {
  const config = getEvmConfig(network);

  if (config.apiUrl.includes("etherscan") || config.apiUrl.includes("arbiscan") ||
      config.apiUrl.includes("optimistic") || config.apiUrl.includes("lineascan") ||
      config.apiUrl.includes("snowtrace")) {
    const params = new URLSearchParams({
      module: "account",
      action: "txlist",
      address,
      sort: "desc",
      page: "1",
      offset: "10",
    });
    if (config.apiKey) params.set("apikey", config.apiKey);

    const res = await fetch(`${config.apiUrl}?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { confirmed: false };

    const data = await res.json();
    if (data.status !== "1" || !data.result) return { confirmed: false };

    const incoming = data.result.find(
      (tx: { to: string; value: string; isError: string }) =>
        tx.to.toLowerCase() === address.toLowerCase() &&
        tx.isError === "0" &&
        (expectedAmount === undefined ||
          parseFloat(tx.value) / 1e18 >= expectedAmount)
    );

    if (incoming) {
      return {
        confirmed: true,
        txHash: incoming.hash,
        amount: parseFloat(incoming.value) / 1e18,
      };
    }
  }

  return { confirmed: false };
}

/* ─── Solana ───────────────────────────────────────────────── */

async function verifySolana(address: string, expectedAmount?: number): Promise<VerificationResult> {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [address, { limit: 10 }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return { confirmed: false };

  const data = await res.json();
  if (!data.result || data.result.length === 0) return { confirmed: false };

  const sigs = data.result as Array<{ signature: string; confirmationStatus: string }>;
  const confirmed = sigs.find(
    (s) => s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized"
  );

  if (confirmed) {
    return {
      confirmed: true,
      txHash: confirmed.signature,
    };
  }

  return { confirmed: false };
}

/* ─── Main verify function ─────────────────────────────────── */

export async function verifyPayment(
  address: string,
  asset: PaymentAsset,
  network: PaymentNetwork,
  expectedAmount?: number
): Promise<VerificationResult> {
  try {
    if (asset === "BTC") {
      if (network === "lightning") return verifyLightning(address);
      return verifyBtcOnChain(address, expectedAmount);
    }

    if (asset === "SOL") {
      return verifySolana(address, expectedAmount);
    }

    return verifyEvm(address, network, expectedAmount, asset);
  } catch (err) {
    console.error("verifyPayment error:", err);
    return { confirmed: false };
  }
}

/* ─── QR code URL generator ────────────────────────────────── */

export function getQrUrl(address: string, asset: PaymentAsset, amount?: number): string {
  let uri = address;

  if (asset === "BTC") {
    uri = `bitcoin:${address}`;
    if (amount) uri += `?amount=${amount}`;
  } else if (asset === "ETH" || asset === "USDC" || asset === "USDT") {
    uri = `ethereum:${address}`;
    if (amount) uri += `?value=${amount}`;
  } else if (asset === "SOL") {
    uri = `solana:${address}`;
    if (amount) uri += `?amount=${amount}`;
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uri)}`;
}

/* ─── Network display names ────────────────────────────────── */

export const NETWORK_LABELS: Record<PaymentNetwork, string> = {
  bitcoin: "Bitcoin",
  lightning: "Lightning Network",
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  linea: "Linea",
  zksync: "zkSync",
  avalanche: "Avalanche C-Chain",
  solana: "Solana",
};

export const SUPPORTED_ASSETS: Array<{ asset: PaymentAsset; network: PaymentNetwork; symbol: string }> = [
  { asset: "BTC", network: "bitcoin", symbol: "BTC" },
  { asset: "BTC", network: "lightning", symbol: "BTC (⚡)" },
  { asset: "ETH", network: "ethereum", symbol: "ETH" },
  { asset: "USDC", network: "ethereum", symbol: "USDC (ERC-20)" },
  { asset: "USDC", network: "arbitrum", symbol: "USDC (Arbitrum)" },
  { asset: "USDC", network: "optimism", symbol: "USDC (Optimism)" },
  { asset: "USDC", network: "linea", symbol: "USDC (Linea)" },
  { asset: "USDC", network: "zksync", symbol: "USDC (zkSync)" },
  { asset: "USDC", network: "avalanche", symbol: "USDC (Avalanche)" },
  { asset: "USDT", network: "ethereum", symbol: "USDT (ERC-20)" },
  { asset: "USDT", network: "arbitrum", symbol: "USDT (Arbitrum)" },
  { asset: "USDT", network: "optimism", symbol: "USDT (Optimism)" },
  { asset: "USDT", network: "linea", symbol: "USDT (Linea)" },
  { asset: "USDT", network: "zksync", symbol: "USDT (zkSync)" },
  { asset: "USDT", network: "avalanche", symbol: "USDT (Avalanche)" },
  { asset: "ETH", network: "arbitrum", symbol: "ETH (Arbitrum)" },
  { asset: "ETH", network: "optimism", symbol: "ETH (Optimism)" },
  { asset: "ETH", network: "linea", symbol: "ETH (Linea)" },
  { asset: "ETH", network: "zksync", symbol: "ETH (zkSync)" },
  { asset: "ETH", network: "avalanche", symbol: "ETH (Avalanche)" },
  { asset: "SOL", network: "solana", symbol: "SOL" },
];
