/*
 * Quartly Bot — components/dashboard/AnimatedThemeToggle.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTheme } from "@once-ui-system/core";
import { BsSunFill, BsMoonFill } from "react-icons/bs";

export function AnimatedThemeToggle() {
  const { theme, resolvedTheme, setTheme: setThemeOnce } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pulses, setPulses] = useState<number[]>([]);
  const [iconState, setIconState] = useState<"visible" | "exiting" | "entering">("visible");
  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
      document.documentElement.classList.remove("theme-transition");
    };
  }, []);

  const isDark = resolvedTheme === "dark";

  const handleToggle = useCallback(() => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    transitionTimeout.current = setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 450);

    const pulseId = Date.now();
    setPulses((prev) => [...prev, pulseId]);
    setTimeout(() => {
      setPulses((prev) => prev.filter((id) => id !== pulseId));
    }, 550);

    setIconState("exiting");
    setTimeout(() => {
      const newTheme = isDark ? "light" : "dark";
      // Use both Once UI setTheme and direct DOM manipulation for reliability
      setThemeOnce(newTheme);
      root.setAttribute("data-theme", newTheme);
      localStorage.setItem("once-ui-theme", newTheme);
      setIconState("entering");
      setTimeout(() => setIconState("visible"), 300);
    }, 200);
  }, [isDark, setThemeOnce, resolvedTheme]);

  const pulseBg = isDark
    ? "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)"
    : "radial-gradient(circle, rgba(20,20,20,0.2) 0%, transparent 70%)";

  return (
    <button
      className="theme-toggle-btn"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={handleToggle}
      type="button"
    >
      {pulses.map((id) => (
        <span key={id} className="theme-toggle-pulse" style={{ background: pulseBg }} />
      ))}
      <span
        className={`theme-toggle-icon ${
          iconState === "entering"
            ? "theme-toggle-icon-enter"
            : iconState === "exiting"
            ? "theme-toggle-icon-exit"
            : ""
        }`}
        style={{ color: "var(--neutral-on-background-strong)" }}
      >
        {mounted ? (
          isDark ? (
            <BsSunFill size={16} />
          ) : (
            <BsMoonFill size={18} />
          )
        ) : (
          <BsMoonFill size={18} />
        )}
      </span>
    </button>
  );
}
