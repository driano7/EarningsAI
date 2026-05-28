"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Column, Heading, Text, Button, Flex, Input, Icon, Card } from "@once-ui-system/core";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
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

        if (data.needsLink) {
          setNeedsLink(true);
          setLinkCode(data.linkCode);
        } else if (data.chatId) {
          localStorage.setItem("quartly_chatId", data.chatId);
          router.push("/dashboard");
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
            <Icon name="presentationChartLine" size="xl" />
            <Heading variant="display-strong-xs">Vincular con Telegram</Heading>
            <Text variant="body-default-m" onBackground="neutral-weak">
              Para sincronizar tus datos, vincula tu cuenta de Telegram con el dashboard.
            </Text>
          </Column>

          <Card padding="l" radius="m" fillWidth>
            <Column horizontal="center" gap="s">
              <Text variant="label-default-xs" onBackground="neutral-weak">Tu código de vinculación</Text>
              <Heading variant="display-strong-l" style={{ letterSpacing: "0.3em" }}>{linkCode}</Heading>
            </Column>
          </Card>

          <Column gap="s" horizontal="center">
            <Text variant="body-default-s" onBackground="neutral-weak">
              1. Abre Telegram y busca <strong>@earningsinfoaibot</strong>
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              2. Envía el comando: <code>/link {linkCode}</code>
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              3. Vuelve aquí y haz clic en "Verificar"
            </Text>
          </Column>

          <Button
            onClick={async () => {
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
                setError("Código actualizado. Envía /link " + data.linkCode + " al bot de Telegram.");
              } else {
                setError("Aún no vinculado. Envía el comando en Telegram y vuelve a intentar.");
              }
            }}
            fillWidth
          >
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
          <Icon name="presentationChartLine" size="xl" />
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
