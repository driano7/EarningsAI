"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Column,
  Row,
  Flex,
  Text,
  IconButton,
  Icon,
  ThemeSwitcher,
} from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";
import { FloatingAssistant } from "@/components/dashboard/FloatingAssistant";
import { MobileDock } from "@/components/dashboard/MobileDock";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Watchlist", href: "/dashboard/watchlist", icon: "watchlist" },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: "portfolio" },
  { label: "Favoritos", href: "/dashboard/favorites", icon: "bolt" },
  { label: "Gastos", href: "/dashboard/transactions", icon: "transactions" },
  { label: "Finanzas", href: "/dashboard/finance", icon: "finance" },
  { label: "Calendario", href: "/dashboard/calendar", icon: "calendar" },
  { label: "Noticias", href: "/dashboard/news", icon: "globeAlt" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem("quartly_auth");
    router.push("/");
  }

  if (!authed) return null;

  if (isMobile) {
    return (
      <Column fillWidth minHeight="100vh">
        <Row
          padding="m"
          vertical="center"
          horizontal="between"
          style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}
        >
          <Flex horizontal="center" vertical="center" gap="s">
            <Icon name="rocket" size="s" />
            <Text variant="heading-default-s">Quartly</Text>
          </Flex>
          <Row gap="s" vertical="center">
            <ThemeSwitcher />
            <IconButton
              icon="logout"
              onClick={handleLogout}
              size="s"
              variant="tertiary"
            />
          </Row>
        </Row>
        <Column fillWidth padding="s" overflow="auto" style={{ maxHeight: "calc(100vh - 60px)" }}>
          {children}
        </Column>
        <MobileDock />
        <FloatingAssistant />
      </Column>
    );
  }

  return (
    <Row fillWidth minHeight="100vh">
      <Column
        as="nav"
        padding="m"
        gap="s"
        style={{
          minWidth: sidebarOpen ? 240 : 60,
          borderRight: "1px solid var(--neutral-alpha-weak)",
          background: "var(--neutral-alpha-weak)",
          transition: "min-width 0.2s ease",
          overflow: "hidden",
        }}
      >
        <Row vertical="center" gap="s" paddingBottom="m" style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}>
          <IconButton
            icon="rocket"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            size="s"
            variant="tertiary"
          />
          {sidebarOpen && (
            <Flex fillWidth horizontal="between" vertical="center">
              <Text variant="heading-default-m" marginLeft="s">⚡️📈 Quartly</Text>
              <IconButton
                icon="logout"
                onClick={handleLogout}
                size="s"
                variant="tertiary"
                tooltip="Cerrar sesión"
              />
            </Flex>
          )}
        </Row>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
              <Row
                vertical="center"
                gap="s"
                padding="xs"
                radius="s"
                fillWidth
                style={{
                  cursor: "pointer",
                  background: isActive ? "var(--brand-alpha-weak)" : "transparent",
                  color: isActive ? "var(--brand-on-background-strong)" : "var(--neutral-on-background-weak)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                  if (!isActive) e.currentTarget.style.background = "var(--neutral-alpha-weak)";
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon name={item.icon} size="s" />
                {sidebarOpen && <Text variant="body-default-s">{item.label}</Text>}
              </Row>
            </Link>
          );
        })}
      </Column>

      <Column fillWidth>
        <Row
          padding="m"
          vertical="center"
          horizontal="between"
          style={{ borderBottom: "1px solid var(--neutral-alpha-weak)" }}
        >
          <ThemeSwitcher />
          <Text variant="body-default-s" onBackground="neutral-weak">
            Quartly Dashboard
          </Text>
        </Row>
        <Column fillWidth padding="l" overflow="auto" style={{ maxHeight: "calc(100vh - 60px)" }}>
          {children}
        </Column>
      </Column>
      <FloatingAssistant />
    </Row>
  );
}
