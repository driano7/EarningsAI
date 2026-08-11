/*
 * Quartly Bot — components/GlobalScrollReveal.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Animación de aparición global: observa todo el sitio (no solo el dashboard)
 * y revela cada objeto al entrar al viewport, scrolleando hacia abajo o hacia
 * arriba. Cuando el elemento sale de la vista vuelve a ocultarse para que la
 * animación se repita al volver.
 */

"use client";

import { useEffect } from "react";

const BLOCK_TAGS = new Set([
  "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "UL", "OL", "LI",
  "TABLE", "FORM", "FIGURE", "ASIDE", "H1", "H2", "H3",
]);

function isBlockish(el: HTMLElement): boolean {
  if (BLOCK_TAGS.has(el.tagName)) return true;
  const cls = el.className;
  if (typeof cls === "string" && /(liquid-glass|glass-card|stat-card|card)/i.test(cls)) return true;
  return false;
}

function qualifies(el: HTMLElement): boolean {
  if (el.dataset.gsr === "skip") return false;
  const style = getComputedStyle(el);
  if (style.position === "fixed" || style.position === "absolute") return false;
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (el.closest(".dropdown-portal, [data-role='dropdown-wrapper'], [data-dropdown='true']")) return false;
  for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
    if (getComputedStyle(n).position === "fixed") return false;
  }
  const text = el.textContent || "";
  const h = el.offsetHeight;
  const w = el.offsetWidth;
  if (isBlockish(el)) return h >= 24 && w >= 80 && text.trim().length > 0;
  return h >= 40 && w >= 160 && text.trim().length > 0;
}

export function GlobalScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | null = null;
    const seen = new Set<Element>();

    function reveal(el: HTMLElement, rect: DOMRect) {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const visible =
        rect.top < vh - 4 && rect.bottom > 4 && rect.left < vw && rect.right > 0;
      if (visible) el.classList.add("gsr-in");
      return visible;
    }

    function candidate(el: HTMLElement) {
      if (!qualifies(el) || seen.has(el)) return;
      seen.add(el);
      el.classList.add("gsr-block");
      const rect = el.getBoundingClientRect();
      if (reveal(el, rect)) return;
      observer?.observe(el);
      requestAnimationFrame(() => {
        if (el.isConnected) {
          const rect2 = el.getBoundingClientRect();
          if (reveal(el, rect2) && document.contains(el)) {
            observer?.unobserve(el);
          }
        }
      });
    }

    function scan(root: ParentNode) {
      const items = root.querySelectorAll<HTMLElement>("div, section, article, main, header, footer, ul, ol, li, table, form, figure, aside, h1, h2, h3");
      items.forEach(candidate);
    }

    function refresh() {
      seen.clear();
      scan(document.body);
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          el.classList.toggle("gsr-in", entry.isIntersecting);
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
    );

    scan(document.body);

    const mo = new MutationObserver(() => {
      scan(document.body);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}