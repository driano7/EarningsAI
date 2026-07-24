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
          bottom: "max(1rem, env(safe-area-inset-bottom))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 90,
          display: "flex",
          justifyContent: "center",
          width: "100%",
          padding: "0 1rem",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: compact ? "0.375rem" : "0.5rem",
            padding: compact ? "0.375rem 0.75rem" : "0.5rem 1rem",
            borderRadius: compact ? "1.35rem" : "1.55rem",
            maxWidth: compact ? "20rem" : "28rem",
            width: "100%",
            background: "rgba(15, 23, 42, 0.86)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)",
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
                  width: compact ? "2rem" : "2.25rem",
                  height: compact ? "2rem" : "2.25rem",
                  borderRadius: "0.75rem",
                  border: isActive ? "1px solid rgba(0, 200, 150, 0.45)" : "1px solid transparent",
                  background: isActive ? "rgba(0, 200, 150, 0.14)" : "transparent",
                  color: isActive ? "#00c896" : "rgba(255, 255, 255, 0.5)",
                  transition: "all 0.3s ease-in-out",
                  textDecoration: "none",
                  flexShrink: 0,
                  boxShadow: isActive ? "0 0 10px rgba(0, 200, 150, 0.55)" : "none",
                  transform: isActive ? "scale(1.05)" : "scale(1)",
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
