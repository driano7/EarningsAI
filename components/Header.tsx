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
  ThemeSwitcher,
} from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "presentationChartLine" },
  { label: "Portafolio", href: "/dashboard/portfolio", icon: "chartPie" },
  { label: "Movimientos", href: "/dashboard/transactions", icon: "arrowsRightLeft" },
  { label: "Bot", href: "/bot", icon: "commandLine" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [time, setTime] = useState("");

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
      >
        {/* ── LEFT: Logo ────────────────────── */}
        <Row gap="12" vertical="center">
          <Icon name="presentationChartLine" size="l" />
          <Heading variant="label-strong-m">Quartly</Heading>
        </Row>

        {/* ── CENTER: Nav ───────────────────── */}
        <Row gap="4" horizontal="center">
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
        <Row gap="24" vertical="center">
          <Text variant="body-default-s" onBackground="neutral-weak">
            {time}
          </Text>
          <Badge background="brand-alpha-medium" onBackground="brand-strong">
            $0.00
          </Badge>
          <ThemeSwitcher />
        </Row>
      </Row>
    </Fade>
  );
}
