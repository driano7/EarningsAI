/*
 * Quartly Bot — lib/kv-payments.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 */

import { kv } from "@vercel/kv";
import { CryptoPaymentAddress, PaymentInvoice, PaymentAsset, PaymentNetwork } from "./types";

/* ─── Payment Addresses ─────────────────────────────────────── */

export async function getPaymentAddresses(chatId: string): Promise<CryptoPaymentAddress[]> {
  const data = await kv.get<CryptoPaymentAddress[]>(`payments:${chatId}:addresses`);
  return data || [];
}

export async function addPaymentAddress(
  chatId: string,
  address: CryptoPaymentAddress
): Promise<void> {
  const addresses = await getPaymentAddresses(chatId);
  addresses.push(address);
  await kv.set(`payments:${chatId}:addresses`, addresses);
}

export async function updatePaymentAddress(
  chatId: string,
  id: string,
  updates: Partial<CryptoPaymentAddress>
): Promise<boolean> {
  const addresses = await getPaymentAddresses(chatId);
  const idx = addresses.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  addresses[idx] = { ...addresses[idx], ...updates };
  await kv.set(`payments:${chatId}:addresses`, addresses);
  return true;
}

export async function deletePaymentAddress(chatId: string, id: string): Promise<boolean> {
  const addresses = await getPaymentAddresses(chatId);
  const filtered = addresses.filter((a) => a.id !== id);
  if (filtered.length === addresses.length) return false;
  await kv.set(`payments:${chatId}:addresses`, filtered);
  return true;
}

/* ─── Global address store (default addresses per asset/network) ── */

export async function getGlobalPaymentAddresses(): Promise<CryptoPaymentAddress[]> {
  const data = await kv.get<CryptoPaymentAddress[]>("payments:global:addresses");
  return data || [];
}

export async function setGlobalPaymentAddresses(addresses: CryptoPaymentAddress[]): Promise<void> {
  await kv.set("payments:global:addresses", addresses);
}

export async function findAddressForAsset(
  asset: PaymentAsset,
  network: PaymentNetwork
): Promise<CryptoPaymentAddress | null> {
  const all = await getGlobalPaymentAddresses();
  return all.find((a) => a.asset === asset && a.network === network && a.active) || null;
}

/* ─── Invoices ──────────────────────────────────────────────── */

export async function getInvoices(chatId: string): Promise<PaymentInvoice[]> {
  const data = await kv.get<PaymentInvoice[]>(`payments:${chatId}:invoices`);
  return data || [];
}

export async function createInvoice(chatId: string, invoice: PaymentInvoice): Promise<void> {
  const invoices = await getInvoices(chatId);
  invoices.unshift(invoice);
  await kv.set(`payments:${chatId}:invoices`, invoices);
}

export async function updateInvoiceStatus(
  chatId: string,
  invoiceId: string,
  status: PaymentInvoice["status"],
  txHash?: string
): Promise<boolean> {
  const invoices = await getInvoices(chatId);
  const idx = invoices.findIndex((i) => i.id === invoiceId);
  if (idx === -1) return false;
  invoices[idx] = {
    ...invoices[idx],
    status,
    ...(txHash ? { txHash } : {}),
    ...(status === "completed" ? { completedAt: new Date().toISOString() } : {}),
  };
  await kv.set(`payments:${chatId}:invoices`, invoices);
  return true;
}

export async function getPendingInvoices(): Promise<PaymentInvoice[]> {
  const chatIds = await kv.smembers("users");
  const all: PaymentInvoice[] = [];
  for (const chatId of chatIds) {
    const invoices = await getInvoices(chatId);
    all.push(...invoices.filter((i) => i.status === "pending"));
  }
  return all;
}
