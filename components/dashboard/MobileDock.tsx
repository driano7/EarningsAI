/*
 * Quartly Bot — components/dashboard/MobileDock.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon, Row } from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

interface DockItem {
  href: string;
  icon: IconName;
  label: string;
}

const dockItems: DockItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Inicio" },
  { href: "/dashboard/favorites", icon: "bolt", label: "Favoritos" },
  { href: "/dashboard/watchlist", icon: "watchlist", label: "Watchlist" },
  { href: "/dashboard/portfolio", icon: "portfolio", label: "Portfolio" },
  { href: "/dashboard/news", icon: "globeAlt", label: "Noticias" },
];

interface MobileDockProps {
  onChatToggle?: () => void;
  chatOpen?: boolean;
}

export function MobileDock({ onChatToggle, chatOpen }: MobileDockProps) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCompact(false);
    timerRef.current = setTimeout(() => setCompact(true), 10000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, resetTimer]);

  useEffect(() => {
    const events = ["pointerdown", "focusin", "scroll"];
    events.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, resetTimer));
  }, [resetTimer]);

  return (
    <>
      <div
        style={{
          height: "calc(5.5rem + env(safe-area-inset-bottom))",
          width: "100%",
          flexShrink: 0,
        }}
      />
      <nav
        style={{
          position: "fixed",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
          left: 0,
          right: 0,
          zIndex: 90,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          className="liquid-glass"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: compact ? "0.25rem" : "0.5rem",
            padding: compact ? "0.4rem 0.75rem" : "0.5rem 1rem",
            borderRadius: compact ? "1.25rem" : "1.5rem",
            width: "fit-content",
            transition: "all 0.3s ease-in-out",
            pointerEvents: "auto",
          }}
        >
          {dockItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: compact ? "2rem" : "2.25rem",
                  height: compact ? "2rem" : "2.25rem",
                  borderRadius: "0.75rem",
                  border: isActive ? "1px solid rgba(0, 200, 150, 0.4)" : "1px solid transparent",
                  background: isActive ? "rgba(0, 200, 150, 0.12)" : "transparent",
                  color: isActive ? "var(--brand-medium)" : "var(--neutral-weak)",
                  transition: "all 0.3s ease-in-out",
                  textDecoration: "none",
                  flexShrink: 0,
                  boxShadow: isActive ? "0 0 10px rgba(0, 200, 150, 0.4)" : "none",
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                }}
              >
                <Icon
                  name={item.icon}
                  size={compact ? "xs" : "xs"}
                  style={{
                    filter: isActive ? "drop-shadow(0 0 6px rgba(0, 200, 150, 0.5))" : "none",
                    transition: "all 0.3s ease-in-out",
                  }}
                />
              </Link>
            );
          })}

          <div
            style={{
              width: 1,
              height: compact ? "1.25rem" : "1.5rem",
              background: "rgba(255,255,255,0.1)",
              flexShrink: 0,
            }}
          />

          <button
            onClick={onChatToggle}
            title="Chatbot"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: compact ? "2rem" : "2.25rem",
              height: compact ? "2rem" : "2.25rem",
              borderRadius: "0.75rem",
              border: chatOpen ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid transparent",
              background: chatOpen ? "rgba(139, 92, 246, 0.12)" : "transparent",
              color: chatOpen ? "var(--accent-medium)" : "var(--neutral-weak)",
              cursor: "pointer",
              transition: "all 0.3s ease-in-out",
              flexShrink: 0,
              boxShadow: chatOpen ? "0 0 10px rgba(139, 92, 246, 0.4)" : "none",
            }}
          >
            <Icon
              name="sparkles"
              size="xs"
              style={{
                filter: chatOpen ? "drop-shadow(0 0 6px rgba(139, 92, 246, 0.5))" : "none",
                transition: "all 0.3s ease-in-out",
              }}
            />
          </button>
        </div>
      </nav>
    </>
  );
}
