"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Column, Heading, Text, Button, Flex, Input, Icon } from "@once-ui-system/core";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
        localStorage.setItem("quartly_chatId", "default");
        router.push("/dashboard");
      } else {
        setError(data.error || "Credenciales inválidas");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
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
            placeholder="donovanriano@gmail.com"
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
