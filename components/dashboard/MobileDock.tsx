"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon, Row } from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

interface DockItem {
  href: string;
  icon: IconName;
}

const dockItems: DockItem[] = [
  { href: "/dashboard", icon: "dashboard" },
  { href: "/dashboard/watchlist", icon: "watchlist" },
  { href: "/dashboard/portfolio", icon: "portfolio" },
  { href: "/dashboard/calendar", icon: "calendar" },
  { href: "/dashboard/news", icon: "globeAlt" },
];

export function MobileDock() {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCompact(false);
    timerRef.current = setTimeout(() => setCompact(true), 20000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, resetTimer]);

  useEffect(() => {
    const events = ["pointerdown", "focusin"];
    events.forEach((e) => document.addEventListener(e, resetTimer));
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
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: compact ? "0.5rem" : "0.75rem",
            padding: compact ? "0.5rem 1rem" : "0.625rem 1.25rem",
            borderRadius: compact ? "1.5rem" : "1.75rem",
            width: "fit-content",
            background: "rgba(20, 20, 30, 0.92)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
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
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: compact ? "2.25rem" : "2.5rem",
                  height: compact ? "2.25rem" : "2.5rem",
                  borderRadius: "0.875rem",
                  border: isActive ? "1px solid rgba(0, 200, 150, 0.45)" : "1px solid transparent",
                  background: isActive ? "rgba(0, 200, 150, 0.14)" : "transparent",
                  color: isActive ? "var(--brand-medium)" : "var(--neutral-weak)",
                  transition: "all 0.3s ease-in-out",
                  textDecoration: "none",
                  flexShrink: 0,
                  boxShadow: isActive ? "0 0 12px rgba(0, 200, 150, 0.5)" : "none",
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                }}
              >
                <Icon
                  name={item.icon}
                  size={compact ? "xs" : "s"}
                  style={{
                    filter: isActive ? "drop-shadow(0 0 8px rgba(0, 200, 150, 0.6))" : "none",
                    transition: "all 0.3s ease-in-out",
                  }}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
