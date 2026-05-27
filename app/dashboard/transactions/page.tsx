/*
 * Quartly Bot — app/dashboard/transactions/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Column, Row, Heading, Text } from "@once-ui-system/core";
import TransactionHistory from "@/components/dashboard/TransactionHistory";
import type { Transaction } from "@/lib/types";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const chatId = typeof window !== "undefined" ? localStorage.getItem("quartly_chatId") || "default" : "default";

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/transactions?chatId=${chatId}`);
      const json = await res.json();
      if (json.ok) setTransactions(json.transactions);
    } catch { /* ignore */ }
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  if (loading) {
    return <Text>Cargando...</Text>;
  }

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Transacciones</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Historial de compras y ventas
        </Text>
      </Column>

      <TransactionHistory transactions={transactions} />
    </Column>
  );
}
