"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Column, Row, Text, Icon } from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";
import { FloatingAssistant } from "@/components/dashboard/FloatingAssistant";
import { MobileDock } from "@/components/dashboard/MobileDock";
import { AnimatedThemeToggle } from "@/components/dashboard/AnimatedThemeToggle";
import { Footer } from "@/components/dashboard/Footer";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Favoritos", href: "/dashboard/favorites", icon: "bolt" },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: "portfolio" },
  { label: "Analisis", href: "/dashboard/portfolio-analytics", icon: "presentationChartLine" },
  { label: "Gastos", href: "/dashboard/transactions", icon: "transactions" },
  { label: "Finanzas", href: "/dashboard/finance", icon: "finance" },
  { label: "Calendario", href: "/dashboard/calendar", icon: "calendar" },
  { label: "Noticias", href: "/dashboard/news", icon: "globeAlt" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const toggleChat = useCallback(() => setChatOpen((p) => !p), []);

  useEffect(() => {
    const auth = localStorage.getItem("quartly_auth");
    const email = localStorage.getItem("quartly_email");
    if (!auth || !email) {
      router.push("/");
    } else {
      setAuthed(true);
    }
  }, [router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Scroll-aware header
  useEffect(() => {
    let lastScroll = 0;
    const handleScroll = () => {
      const current = window.scrollY;
      setHeaderVisible(current < 80 || current < lastScroll);
      lastScroll = current;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("quartly_auth");
    router.push("/");
  }

  if (!authed) return null;

  return (
    <Column fillWidth minHeight="100vh">
      {/* ── Floating Header ── */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 0,
          right: 0,
          zIndex: 40,
          display: "flex",
          justifyContent: "center",
          padding: "0 16px",
          pointerEvents: "none",
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: headerVisible ? "translateY(0)" : "translateY(-120%)",
          opacity: headerVisible ? 1 : 0,
        }}
      >
        <header
          className="liquid-glass"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 8 : 16,
            padding: isMobile ? "10px 14px" : "12px 20px",
            borderRadius: "2rem",
            width: "min(900px, 100%)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {/* Logo */}
          <Link
            href="/dashboard"
            style={{
              textDecoration: "none",
              color: "var(--brand-on-background-strong)",
              fontSize: isMobile ? "1.1rem" : "1.3rem",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            ⚡️📈 Quartly
          </Link>

          {/* Nav (desktop) */}
          {!isMobile && (
            <nav style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      textDecoration: "none",
                      padding: "6px 10px",
                      borderRadius: "0.75rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      color: active
                        ? "var(--brand-on-background-strong)"
                        : "var(--neutral-on-background-weak)",
                      background: active ? "var(--brand-alpha-weak)" : "transparent",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Icon name={item.icon} size="xs" />
                    {item.label}
                    {active && (
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "var(--brand-on-background-strong)",
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <AnimatedThemeToggle />
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesion"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid transparent",
                background: "transparent",
                cursor: "pointer",
                color: "var(--neutral-on-background-weak)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--neutral-alpha-weak)";
                e.currentTarget.style.borderColor = "var(--neutral-alpha-medium)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <Icon name="logout" size="s" />
            </button>
          </div>
        </header>
      </div>

      {/* ── Content ── */}
      <Column
        fillWidth
        padding={isMobile ? "s" : "l"}
        paddingTop={isMobile ? "80px" : "100px"}
        paddingBottom={isMobile ? "120px" : "l"}
        gap="l"
      >
        {children}
        <Footer />
      </Column>

      {/* ── Mobile Dock + Chatbot ── */}
      {isMobile && (
        <>
          <MobileDock onChatToggle={toggleChat} chatOpen={chatOpen} />
          <FloatingAssistant open={chatOpen} onToggle={toggleChat} />
        </>
      )}

      {/* ── Desktop Chatbot ── */}
      {!isMobile && <FloatingAssistant />}
    </Column>
  );
}
