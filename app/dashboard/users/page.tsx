/*
 * Quartly Bot — page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState } from "react";
import { Column, Row, Heading, Text, Badge, IconButton } from "@once-ui-system/core";

interface UserData {
  chatId: string;
  stocks: number;
  etfs: number;
  totalWatchlist: number;
  tickers: string[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  function loadUsers() {
    const password = localStorage.getItem("quartly_auth");
    fetch("/api/dashboard/users", {
      headers: { Authorization: `Bearer ${password}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setUsers(data.users);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleRemoveUser(chatId: string) {
    if (!confirm(`¿Eliminar al usuario ${chatId} y toda su watchlist?`)) return;
    const password = localStorage.getItem("quartly_auth");
    await fetch("/api/dashboard/users", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    });
    loadUsers();
  }

  const totalWatchlist = users.reduce((sum, u) => sum + u.totalWatchlist, 0);

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Usuarios</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          {users.length} usuarios registrados · {totalWatchlist} activos en watchlists
        </Text>
      </Column>

      <Column gap="s">
        {users.map((user) => (
          <Row
            key={user.chatId}
            padding="m"
            radius="m"
            fillWidth
            vertical="center"
            horizontal="between"
            className="glass-card"
          >
            <Row gap="m" vertical="center">
              <Column gap="xs">
                <Text variant="body-default-m">Chat ID: {user.chatId}</Text>
                <Row gap="s">
                  <Badge textVariant="label-default-s" color="brand">
                    {user.stocks} stocks
                  </Badge>
                  <Badge textVariant="label-default-s" color="accent">
                    {user.etfs} ETFs
                  </Badge>
                  <Badge textVariant="label-default-s" color="neutral">
                    {user.totalWatchlist} total
                  </Badge>
                </Row>
              </Column>
            </Row>
            <Row gap="m" vertical="center">
              <Text variant="body-default-s" onBackground="neutral-weak">
                {user.tickers.slice(0, 3).join(", ")}
                {user.tickers.length > 3 ? `... (+${user.tickers.length - 3})` : ""}
              </Text>
              <IconButton
                icon="trash"
                onClick={() => handleRemoveUser(user.chatId)}
                size="s"
                variant="tertiary"
                tooltip="Eliminar usuario"
              />
            </Row>
          </Row>
        ))}
        {users.length === 0 && !loading && (
          <Text variant="body-default-m" onBackground="neutral-weak">
            No hay usuarios registrados
          </Text>
        )}
      </Column>
    </Column>
  );
}
