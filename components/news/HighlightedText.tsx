/*
 * Quartly Bot — components/news/HighlightedText.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

interface HighlightedTextProps {
  text: string;
  variant?: string;
  onBackground?: string;
  style?: React.CSSProperties;
  brandColor?: string;
}

function isImportantLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (/(semaf|vedicto|conclus|catalizador|recomendaci|señal|senal|apuesta)/.test(lower)) return true;
  if (/[🟢🟡🔴✅❌⚠️🟩🟨🟥]/.test(line)) return true;
  if (/^(>|→|v?^\s*[+-]?\d)/.test(line.trim())) return false;
  return /(importante|clave|principal|riesgo|tendencia|romp|resisten|soporte)/.test(lower);
}

function renderLine(line: string, index: number, brandColor: string, keyPrefix: string) {
  const important = isImportantLine(line);
  if (!important) {
    return <span key={`${keyPrefix}-${index}`}>{line || "\u00A0"}</span>;
  }
  return (
    <span
      key={`${keyPrefix}-${index}`}
      style={{
        textDecoration: "underline",
        textDecorationColor: brandColor,
        textDecorationThickness: 2,
        textUnderlineOffset: 3,
      }}
    >
      {line || "\u00A0"}
    </span>
  );
}

export function HighlightedText({
  text,
  style,
  brandColor = "var(--brand-medium)",
}: HighlightedTextProps) {
  const lines = text.split("\n");

  return (
    <span
      style={{
        display: "block",
        whiteSpace: "pre-wrap",
        lineHeight: 1.6,
        ...style,
      }}
    >
      {lines.length === 1
        ? renderLine(lines[0], 0, brandColor, "a")
        : lines.map((line, i) => (
            <span key={`line-${i}`} style={{ display: "block" }}>
              {renderLine(line, i, brandColor, `b-${i}`)}
              {i < lines.length - 1 ? "\n" : ""}
            </span>
          ))}
    </span>
  );
}