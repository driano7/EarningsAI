"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isLoading?: boolean;
}

export function useChatbot(chatId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hola, soy Quartly 👋 Tu analista personal. Puedo darte reportes de earnings, analizar tu portafolio, ver tu resumen financiero, o responder preguntas sobre el mercado. ¿En qué te ayudo?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      const loadingMsg: ChatMessage = {
        id: "loading",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setIsLoading(true);

      try {
        abortRef.current = new AbortController();
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

        const res = await fetch("/api/dashboard/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content.trim(), chatId, history }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "Sin respuesta.",
          timestamp: data.timestamp || new Date().toISOString(),
        };

        setMessages((prev) => [...prev.filter((m) => m.id !== "loading"), assistantMsg]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== "loading"),
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Error de conexión. Intenta de nuevo.",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, messages, isLoading]
  );

  const clearChat = useCallback(() => {
    setMessages((prev) => [prev[0]]);
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
