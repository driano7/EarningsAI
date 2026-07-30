/*
 * Quartly Bot — app/bot/page.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Column, Row, Heading, Text, Input, IconButton, Badge, Icon, Button,
} from "@once-ui-system/core";
import { AnimatePresence, motion } from "framer-motion";
import { useChatbot } from "@/hooks/useChatbot";

const QUICK_ACTIONS = [
  { label: "📊 Mi reporte", message: "Dame el reporte de earnings de mis acciones" },
  { label: "💰 Resumen mes", message: "Dame el resumen de mis finanzas de este mes" },
  { label: "📈 Portafolio", message: "Muéstrame mi portafolio con P&L actual" },
  { label: "🔥 Hype Ranking", message: "Qué acciones tienen más hype esta semana" },
];

export default function BotPage() {
  const [chatId, setChatId] = useState("");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatId(localStorage.getItem("quartly_chatId") || "default");
  }, []);

  const { messages, isLoading, sendMessage, clearChat } = useChatbot(chatId);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Column fillWidth position="relative" style={{ height: "calc(100vh - 64px)" }}>
      {/* ── HEADER ─────────────────────────── */}
      <Row
        fillWidth
        padding="m"
        borderBottom="neutral-alpha-medium"
        vertical="center"
        horizontal="between"
        gap="m"
      >
        <Row gap="m" vertical="center">
          <Badge
            background="success-alpha-weak"
            onBackground="success-strong"
            paddingX="s"
            paddingY="xs"
          >
            <Row gap="xs" vertical="center">
              <Icon name="circle" size="xs" />
              <Text variant="label-default-xs">En línea</Text>
            </Row>
          </Badge>
          <Column gap="xs">
            <Heading variant="heading-strong-s">Quartly AI</Heading>
            <Text variant="label-default-xs" onBackground="neutral-weak">
              Analista bursátil personal
            </Text>
          </Column>
        </Row>
        <IconButton
          icon="trash"
          size="s"
          variant="tertiary"
          tooltip="Limpiar chat"
          onClick={clearChat}
        />
      </Row>

      {/* ── QUICK ACTIONS ──────────────────── */}
      <Row
        fillWidth
        paddingX="m"
        paddingY="s"
        gap="s"
        style={{ overflowX: "auto", flexWrap: "nowrap" }}
      >
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            size="s"
            variant="secondary"
            onClick={() => sendMessage(action.message)}
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {action.label}
          </Button>
        ))}
      </Row>

      {/* ── MESSAGES ───────────────────────── */}
      <Column
        fillWidth
        paddingX="m"
        paddingY="s"
        gap="m"
        style={{ overflowY: "auto", flex: 1 }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Row fillWidth horizontal={msg.role === "user" ? "end" : "start"}>
                <Column
                  maxWidth="75%"
                  padding="s"
                  radius="l"
                  background={msg.role === "user" ? "brand-medium" : "surface"}
                  border={msg.role === "assistant" ? "neutral-alpha-weak" : undefined}
                  gap="xs"
                >
                  {msg.isLoading ? (
                    <Row gap="xs" vertical="center" paddingY="s" paddingX="s">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--neutral-on-background-weak)",
                          }}
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </Row>
                  ) : (
                    <Text
                      variant="body-default-s"
                      onBackground={msg.role === "user" ? "brand-strong" : "neutral-strong"}
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    >
                      {msg.content}
                    </Text>
                  )}
                  {!msg.isLoading && (
                    <Text
                      variant="label-default-xs"
                      onBackground={msg.role === "user" ? "brand-weak" : "neutral-weak"}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Mexico_City",
                      })}
                    </Text>
                  )}
                </Column>
              </Row>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={scrollRef} />
      </Column>

      {/* ── INPUT ──────────────────────────── */}
      <Row
        fillWidth
        padding="m"
        borderTop="neutral-alpha-medium"
        gap="s"
        vertical="center"
      >
        <Input
          id="chat-input"
          placeholder="Escribe tu consulta..."
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim()) {
                sendMessage(input);
                setInput("");
              }
            }
          }}
          style={{ flex: 1 }}
        />
        <IconButton
          icon="arrowUp"
          size="m"
          variant="primary"
          disabled={!input.trim() || isLoading}
          onClick={() => {
            if (input.trim()) {
              sendMessage(input);
              setInput("");
            }
          }}
        />
      </Row>
    </Column>
  );
}
