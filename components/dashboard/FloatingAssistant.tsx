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

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
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
      {/* ── FLOATING BUTTON ─────────────────────── */}
      <motion.div
        style={{
          position: "fixed",
          bottom: isMobile ? "calc(6rem + env(safe-area-inset-bottom))" : 24,
          right: 24,
          zIndex: 1000,
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <IconButton
          icon="sparkles"
          size="l"
          variant="primary"
          onClick={() => setOpen(!open)}
          style={{
            borderRadius: "50%",
            width: 56,
            height: 56,
            boxShadow: "0 4px 24px var(--brand-alpha-medium)",
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

      {/* ── CHAT PANEL ─────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              position: "fixed",
              inset: isMobile ? 0 : undefined,
              bottom: isMobile ? 0 : 92,
              right: isMobile ? undefined : 24,
              top: isMobile ? 0 : undefined,
              left: isMobile ? undefined : undefined,
              width: isMobile ? "100%" : 380,
              maxHeight: isMobile ? "100vh" : "calc(100vh - 140px)",
              zIndex: isMobile ? 2000 : 999,
              borderRadius: isMobile ? 0 : 16,
              overflow: "hidden",
              border: isMobile ? "none" : "1px solid var(--neutral-alpha-medium)",
              background: "var(--neutral-background)",
              boxShadow: isMobile ? "none" : "0 8px 40px rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <Row
              padding="m"
              vertical="center"
              horizontal="between"
              style={{
                borderBottom: "1px solid var(--neutral-alpha-weak)",
                paddingTop: isMobile ? "max(1rem, env(safe-area-inset-top))" : undefined,
              }}
            >
              <Row gap="s" vertical="center">
                <IconButton
                  icon="arrowLeft"
                  size="s"
                  variant="tertiary"
                  onClick={() => setOpen(false)}
                />
                <Badge
                  background="success-alpha-weak"
                  onBackground="success-strong"
                  paddingX="s"
                  paddingY="xs"
                >
                  <Row gap="xs" vertical="center">
                    <Icon name="sparkles" size="xs" />
                    <Text variant="label-default-xs">En línea</Text>
                  </Row>
                </Badge>
                <Text variant="heading-strong-s">Quartly AI</Text>
              </Row>
              <IconButton
                icon="trash"
                size="s"
                variant="tertiary"
                tooltip="Limpiar chat"
                onClick={clearChat}
              />
            </Row>

            {/* Quick Actions */}
            <Row
              paddingX="m"
              paddingY="s"
              gap="s"
              style={{ overflowX: "auto", flexWrap: "nowrap", borderBottom: "1px solid var(--neutral-alpha-weak)" }}
            >
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.message)}
                  style={{
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--neutral-alpha-medium)",
                    background: "var(--neutral-alpha-weak)",
                    color: "var(--neutral-on-background-strong)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {a.label}
                </button>
              ))}
            </Row>

            {/* Messages */}
            <Column
              padding="m"
              gap="m"
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
                    radius="l"
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
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "var(--neutral-on-background-weak)",
                            }}
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
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
                  </Column>
                </Row>
              ))}
              <div ref={scrollRef} />
            </Column>

            {/* Input */}
            <Row
              padding="m"
              gap="s"
              vertical="center"
              style={{
                borderTop: "1px solid var(--neutral-alpha-weak)",
                paddingBottom: isMobile ? "max(1rem, env(safe-area-inset-bottom))" : undefined,
              }}
            >
              <Input
                id="floating-chat-input"
                placeholder="Escribe tu consulta..."
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                style={{ flex: 1 }}
              />
              <IconButton
                icon="arrowUp"
                size="m"
                variant="primary"
                disabled={!input.trim() || isLoading}
                onClick={handleSend}
              />
            </Row>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
