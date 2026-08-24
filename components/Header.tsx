/*
 * Quartly Bot — Header.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Row,
  Column,
  Heading,
  Text,
  Icon,
  Badge,
  ToggleButton,
  Fade,
} from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";
import { formatCurrency } from "@/lib/formatFinance";
import { AnimatedThemeToggle } from "@/components/dashboard/AnimatedThemeToggle";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "presentationChartLine" },
  { label: "Portafolio", href: "/dashboard/portfolio", icon: "chartPie" },
  { label: "Superinversores", href: "/dashboard/superinversores", icon: "users" },
  { label: "Movimientos", href: "/dashboard/transactions", icon: "arrowsRightLeft" },
  { label: "Bot", href: "/bot", icon: "commandLine" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [time, setTime] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  const chatId = typeof window !== "undefined"
    ? localStorage.getItem("quartly_chatId") || "default"
    : "default";

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat("es-MX", {
          timeZone: "America/Mexico_City",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch(`/api/dashboard/portfolio?chatId=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.positions?.length > 0) {
          const total = data.positions.reduce(
            (sum: number, p: { buyPrice: number; quantity: number }) => sum + p.buyPrice * p.quantity,
            0
          );
          setBalance(total);
        }
      })
      .catch(() => { /* ignore */ });
  }, [chatId]);

  return (
    <Fade
      position="fixed"
      zIndex={9}
      fillWidth
      base="surface"
      blur={12}
    >
      <Row
        as="header"
        position="sticky"
        zIndex={9}
        fillWidth
        paddingX="24"
        paddingY="16"
        vertical="center"
        horizontal="between"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}
      >
        {/* ── LEFT: Logo ────────────────────── */}
        <Row gap="12" vertical="center" style={{ flex: "0 0 auto" }}>
          <Heading variant="label-strong-l">⚡️📈</Heading>
          <Heading variant="label-strong-m">Quartly</Heading>
        </Row>

        {/* ── CENTER: Nav ───────────────────── */}
        <Row gap="4" horizontal="center" style={{ flex: "1 1 auto", justifyContent: "center", minWidth: 0 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <ToggleButton
                key={item.href}
                selected={isActive}
                variant="ghost"
                size="m"
                weight={isActive ? "strong" : "default"}
                onClick={() => router.push(item.href)}
              >
                <Row gap="8" vertical="center">
                  <Icon name={item.icon} size="s" />
                  <Text variant="body-default-s">{item.label}</Text>
                </Row>
              </ToggleButton>
            );
          })}
        </Row>

        {/* ── RIGHT: Time + Balance + Theme ─── */}
        <Row gap="16" vertical="center" style={{ flex: "0 0 auto", justifyContent: "flex-end" }}>
          <Text variant="body-default-s" onBackground="neutral-weak" style={{ whiteSpace: "nowrap" }}>
            {time}
          </Text>
          <Badge background="brand-alpha-medium" onBackground="brand-strong" style={{ whiteSpace: "nowrap" }}>
            {balance !== null ? formatCurrency(balance) : "—"}
          </Badge>
          <AnimatedThemeToggle />
        </Row>
      </Row>
    </Fade>
  );
}
