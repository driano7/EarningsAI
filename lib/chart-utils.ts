/*
 * Quartly Bot — lib/chart-utils.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

import { toPng } from "html-to-image";
import * as XLSX from "xlsx";

export async function downloadChartPng(container: HTMLElement | null, filename: string) {
  if (!container) return;
  const dataUrl = await toPng(container, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "transparent",
  });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

export function exportCsvDownload(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = toCsv(headers, rows);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function exportXlsxDownload(headers: string[], rows: (string | number)[][], filename: string, sheetName = "Data") {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([buf], { type: "application/octet-stream" }), filename);
}
