/*
 * Quartly Bot — components/dashboard/FloatingAssistant.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Column, Row, Text, Input, IconButton, Icon, Badge } from "@once-ui-system/core";
import { AnimatePresence, motion } from "framer-motion";
import { useChatbot } from "@/hooks/useChatbot";

const QUICK_ACTIONS = [
  { label: "Reporte", message: "Dame el reporte de earnings de mis acciones" },
  { label: "Resumen", message: "Dame el resumen de mis finanzas de este mes" },
  { label: "Portafolio", message: "Muéstrame mi portafolio con P&L actual" },
  { label: "Hype", message: "Qué acciones tienen más hype esta semana" },
];

interface FloatingAssistantProps {
  open?: boolean;
  onToggle?: () => void;
}

export function FloatingAssistant({ open: externalOpen, onToggle }: FloatingAssistantProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onToggle || setInternalOpen;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatId, setChatId] = useState("default");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setChatId(localStorage.getItem("quartly_chatId") || "default");
  }, []);

  const { messages, isLoading, sendMessage, clearChat } = useChatbot(chatId);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  }

  return (
    <>
      {!isMobile && (
        <motion.div
          style={{
            position: "fixed",
            bottom: 24,
            right: 20,
            zIndex: 1000,
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <IconButton
            icon="sparkles"
            size="m"
            variant="primary"
            onClick={() => setOpen(!open)}
            style={{
              borderRadius: "50%",
              width: 48,
              height: 48,
              boxShadow: "0 4px 20px var(--brand-alpha-medium)",
            }}
          />
          {!open && messages.length <= 1 && (
            <Badge
              background="danger-medium"
              onBackground="danger-strong"
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                borderRadius: "50%",
                width: 18,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              1
            </Badge>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="liquid-glass"
            style={{
              position: "fixed",
              inset: isMobile ? undefined : undefined,
              bottom: isMobile ? "calc(5rem + env(safe-area-inset-bottom))" : 80,
              right: isMobile ? 12 : 16,
              top: isMobile ? undefined : undefined,
              left: isMobile ? 12 : undefined,
              width: isMobile ? "calc(100% - 24px)" : 340,
              height: isMobile ? "50vh" : undefined,
              maxHeight: isMobile ? "50vh" : "calc(100vh - 120px)",
              zIndex: isMobile ? 2000 : 999,
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--neutral-background)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Row
              padding="s"
              paddingX="m"
              vertical="center"
              horizontal="between"
              style={{
                borderBottom: "1px solid var(--neutral-alpha-weak)",
                paddingTop: isMobile ? "max(0.5rem, env(safe-area-inset-top))" : undefined,
                background: "var(--neutral-background)",
                flexShrink: 0,
              }}
            >
              <Row gap="s" vertical="center">
                <Badge
                  background="success-alpha-weak"
                  onBackground="success-strong"
                  paddingX="s"
                  paddingY="xs"
                >
                  <Row gap="xs" vertical="center">
                    <Icon name="sparkles" size="xs" />
                    <Text variant="label-default-xs">Online</Text>
                  </Row>
                </Badge>
                <Text variant="heading-strong-s">Quartly AI</Text>
              </Row>
              <Row gap="xs">
                <IconButton
                  icon="trash"
                  size="xs"
                  variant="tertiary"
                  tooltip="Limpiar"
                  onClick={clearChat}
                />
                <IconButton
                  icon="close"
                  size="xs"
                  variant="tertiary"
                  onClick={() => setOpen(false)}
                />
              </Row>
            </Row>

            <Row
              paddingX="s"
              paddingY="xs"
              gap="xs"
              style={{
                overflowX: "auto",
                flexWrap: "nowrap",
                borderBottom: "1px solid var(--neutral-alpha-weak)",
                flexShrink: 0,
              }}
            >
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.message)}
                  className="liquid-btn"
                  style={{
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--neutral-alpha-medium)",
                    background: "var(--neutral-alpha-weak)",
                    color: "var(--neutral-on-background-strong)",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {a.label}
                </button>
              ))}
            </Row>

            <Column
              padding="s"
              paddingX="m"
              gap="s"
              style={{ overflowY: "auto", flex: 1, minHeight: 0 }}
            >
              {messages.map((msg) => (
                <Row
                  key={msg.id}
                  fillWidth
                  horizontal={msg.role === "user" ? "end" : "start"}
                >
                  <Column
                    maxWidth="85%"
                    padding="s"
                    radius="m"
                    background={msg.role === "user" ? "brand-medium" : "surface"}
                    border={msg.role === "assistant" ? "neutral-alpha-weak" : undefined}
                    gap="xs"
                  >
                    {msg.isLoading ? (
                      <Row gap="xs" vertical="center" paddingY="s">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: "var(--neutral-on-background-weak)",
                            }}
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </Row>
                    ) : (
                      <Text
                        variant="body-default-xs"
                        onBackground={msg.role === "user" ? "brand-strong" : "neutral-strong"}
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}
                      >
                        {msg.content}
                      </Text>
                    )}
                  </Column>
                </Row>
              ))}
              <div ref={scrollRef} />
            </Column>

            <Row
              padding="s"
              paddingX="m"
              gap="s"
              vertical="center"
              style={{
                borderTop: "1px solid var(--neutral-alpha-weak)",
                paddingBottom: isMobile ? "max(0.5rem, env(safe-area-inset-bottom))" : undefined,
                background: "var(--neutral-background)",
                flexShrink: 0,
              }}
            >
              <Input
                id="floating-chat-input"
                placeholder="Escribe..."
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                style={{ flex: 1, fontSize: 13 }}
              />
              <IconButton
                icon="arrowUp"
                size="s"
                variant="primary"
                disabled={!input.trim() || isLoading}
                onClick={handleSend}
                className="liquid-btn"
              />
            </Row>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
