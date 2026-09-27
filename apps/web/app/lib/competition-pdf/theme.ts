/**
 * Thème des exports PDF de compétition (ligues et coupes).
 *
 * Pensé pour l'IMPRESSION : fond blanc (aucun aplat pleine page qui vide une
 * cartouche), encre sombre, un seul accent bronze pour les bandeaux et les
 * filets. Les aplats restent pâles et ponctuels (en-têtes de tableau,
 * qualifiés) pour survivre à une photocopie noir et blanc.
 */

import type jsPDF from "jspdf";

export type RGB = [number, number, number];

export const PDF_COLORS = {
  INK: "#1C1917",
  INK_SOFT: "#57534E",
  INK_FAINT: "#A8A29E",
  RULE: "#D6D3D1",
  ACCENT: "#8C6A1F",
  ACCENT_DARK: "#5C4411",
  ACCENT_TINT: "#F5EDDA",
  HEAD_FILL: "#2A2420",
  ZEBRA: "#FAF8F4",
  QUALIFIED: "#E7F0DF",
  QUALIFIED_INK: "#365E2A",
  MUTED_ROW: "#EFEDEA",
  WHITE: "#FFFFFF",
} as const;

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [0, 0, 0];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function setFill(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

export function setDraw(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

export function setText(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

/**
 * Les polices standard de jsPDF n'encodent que WinAnsi : un emoji, une flèche
 * ou un « ≥ » sortirait en caractères parasites. On les remplace par un
 * équivalent imprimable plutôt que de laisser un nom d'équipe illisible.
 */
const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/[→➡]/g, ">"],
  [/←/g, "<"],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/[−‒]/g, "-"],
  [/ | /g, " "],
];

export function pdfSafe(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  let out = String(text);
  for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
  // Tout ce qui sort de Latin-1 étendu (+ ponctuation typographique WinAnsi)
  // est retiré : emojis, pictogrammes, sélecteurs de variante.
  out = out.replace(/[^\u0000-ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/gu, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Formate un montant en po (« 1 150 k po », « 0 po »). */
export function formatGoldPdf(po: number | null | undefined): string {
  if (po === null || po === undefined || !Number.isFinite(po)) return "";
  if (Math.abs(po) >= 1_000) {
    const k = Math.round(po / 1_000);
    return `${groupThousands(k)} k po`;
  }
  return `${po} po`;
}

/** Séparateur de milliers ASCII (toLocaleString sort une espace fine insécable). */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(n)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Diff signée « +3 », « -2 », « 0 ». */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
