"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Column, Heading, Text, Button, Input, Card } from "@once-ui-system/core";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);
  const router = useRouter();

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
        } else if (data.needsLink) {
          setNeedsLink(true);
          setLinkCode(data.linkCode);
          setRegisteredUsers(data.registeredUsers || []);
        } else {
          router.push("/dashboard");
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

  async function verifyLink() {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.ok && data.chatId) {
      localStorage.setItem("quartly_chatId", data.chatId);
      router.push("/dashboard");
    } else if (data.ok && data.needsLink) {
      setLinkCode(data.linkCode);
      setRegisteredUsers(data.registeredUsers || []);
      setError("Código actualizado. Envía /link " + data.linkCode + " al bot de Telegram, o selecciona tu chatId de la lista.");
    } else {
      setError("Aún no vinculado.");
    }
  }

  if (needsLink) {
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
            <Heading variant="display-strong-xs">Vincular con Telegram</Heading>
            <Text variant="body-default-m" onBackground="neutral-weak">
              Para sincronizar datos elige tu cuenta de Telegram:
            </Text>
          </Column>

          {registeredUsers.length > 0 && (
            <Column gap="s">
              <Text variant="label-default-xs" onBackground="neutral-weak">Usuarios registrados en KV</Text>
              {registeredUsers.map((uid) => (
                <Card key={uid} padding="m" radius="m" fillWidth
                  style={{ cursor: "pointer" }}
                  onClick={() => selectChatId(uid)}
                >
                  <Row vertical="center" gap="s">
                    <Text variant="body-default-l">🤖</Text>
                    <Column gap="xs">
                      <Text variant="label-strong-s">Chat ID: {uid}</Text>
                      <Text variant="label-default-xs" onBackground="neutral-weak">
                        Haz clic para usar esta cuenta
                      </Text>
                    </Column>
                  </Row>
                </Card>
              ))}
            </Column>
          )}

          <Column gap="s" horizontal="center">
            <Text variant="label-default-xs" onBackground="neutral-weak">— O vincular automáticamente —</Text>
          </Column>

          <Card padding="l" radius="m" fillWidth>
            <Column horizontal="center" gap="s">
              <Text variant="label-default-xs" onBackground="neutral-weak">Código de vinculación</Text>
              <Heading variant="display-strong-l" style={{ letterSpacing: "0.3em" }}>{linkCode}</Heading>
            </Column>
          </Card>

          <Column gap="xs" horizontal="center">
            <Text variant="body-default-s" onBackground="neutral-weak">
              1. En Telegram envía: <code>/link {linkCode}</code>
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              2. Vuelve y presiona "Verificar"
            </Text>
          </Column>

          <Button onClick={verifyLink} fillWidth>
            Verificar vinculación
          </Button>

          {error && (
            <Text variant="body-default-s" onBackground="danger-weak">
              {error}
            </Text>
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
          <Text variant="body-default-s" onBackground="danger-weak">
            {error}
          </Text>
        )}
        <Button type="submit" disabled={loading} fillWidth>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </Column>
    </Column>
  );
}
