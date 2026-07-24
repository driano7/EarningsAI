/*
 * Quartly Bot — page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Button, Input, Card } from "@once-ui-system/core";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);
  const [manualChatId, setManualChatId] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/users").then((r) => r.json()).then((data) => {
      if (data.ok) setRegisteredUsers(data.users);
    }).catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.ok) {
        localStorage.setItem("quartly_auth", password);
        localStorage.setItem("quartly_email", email);

        if (data.chatId) {
          localStorage.setItem("quartly_chatId", data.chatId);
          router.push("/dashboard");
        } else {
          setShowPicker(true);
        }
      } else {
        setError(data.error || "Credenciales inválidas");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  function selectChatId(chatId: string) {
    localStorage.setItem("quartly_chatId", chatId);
    router.push("/dashboard");
  }

  function handleManualChatId() {
    if (manualChatId.trim()) {
      selectChatId(manualChatId.trim());
    }
  }

  if (showPicker) {
    return (
      <Column fillWidth minHeight="100vh" horizontal="center" vertical="center" padding="l">
        <Column maxWidth="xs" gap="l" padding="xl" radius="m"
          style={{
            background: "var(--neutral-alpha-weak)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--neutral-alpha-medium)",
          }}
        >
          <Column gap="s" horizontal="center">
            <Text variant="display-strong-l">⚡️📈</Text>
            <Heading variant="display-strong-xs">Selecciona tu cuenta</Heading>
            <Text variant="body-default-m" onBackground="neutral-weak">
              Elige tu cuenta de Telegram para cargar tus datos:
            </Text>
          </Column>

          {registeredUsers.length > 0 && (
            <Column gap="s">
              <Text variant="label-default-xs" onBackground="neutral-weak">Usuarios registrados</Text>
              {registeredUsers.map((uid) => (
                <Card key={uid} padding="m" radius="m" fillWidth
                  style={{ cursor: "pointer" }}
                  onClick={() => selectChatId(uid)}
                >
                  <Row vertical="center" gap="s">
                    <Text variant="body-default-l">🤖</Text>
                    <Column gap="xs">
                      <Text variant="label-strong-s">Chat ID: {uid}</Text>
                      <Text variant="label-default-xs" onBackground="neutral-weak">Haz clic para usar esta cuenta</Text>
                    </Column>
                  </Row>
                </Card>
              ))}
            </Column>
          )}

          <Column gap="s" horizontal="center">
            <Text variant="label-default-xs" onBackground="neutral-weak">— O ingresa manualmente —</Text>
          </Column>

          <Row gap="s" vertical="center">
            <Input
              id="manual-chatid"
              label="Chat ID"
              type="text"
              placeholder="Ej: 123456789"
              value={manualChatId}
              onChange={(e) => setManualChatId(e.target.value)}
            />
            <Button onClick={handleManualChatId} disabled={!manualChatId.trim()}>
              Usar
            </Button>
          </Row>

          {error && (
            <Text variant="body-default-s" onBackground="danger-weak">{error}</Text>
          )}
        </Column>
      </Column>
    );
  }

  return (
    <Column fillWidth minHeight="100vh" horizontal="center" vertical="center" padding="l">
      <Column
        as="form"
        onSubmit={handleLogin}
        maxWidth="xs"
        gap="l"
        padding="xl"
        radius="m"
        style={{
          background: "var(--neutral-alpha-weak)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--neutral-alpha-medium)",
        }}
      >
        <Column gap="s" horizontal="center">
          <Text variant="display-strong-l">⚡️📈</Text>
          <Heading variant="display-strong-xs">Quartly</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Panel de administración
          </Text>
        </Column>
        <Column gap="s">
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
          <Input
            id="password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Column>
        {error && (
          <Text variant="body-default-s" onBackground="danger-weak">{error}</Text>
        )}
        <Button type="submit" disabled={loading} fillWidth>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </Column>
    </Column>
  );
}
