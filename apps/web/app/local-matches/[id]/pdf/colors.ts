/**
 * Palette + helpers couleur pour le PDF de recap de match Blood Bowl.
 *
 * - Palette parchemin/sang/or, inspiree des programmes de match GW.
 * - Helpers convertissent entre 0xRRGGBB (game-engine), hex string ("#RRGGBB")
 *   et tuple RGB [r,g,b] attendu par jspdf-autotable.
 * - `lighten` et `ensureContrast` rendent les couleurs d'equipe dynamiques
 *   utilisables sur fond parchemin sans illisibilite.
 */

import type jsPDF from "jspdf";

export type RGB = [number, number, number];

export const PALETTE = {
  INK: "#1A140C",
  INK_SOFT: "#3A2E1F",
  PARCHMENT: "#F4E8C8",
  PARCHMENT_DARK: "#E5D2A1",
  PARCHMENT_HIGHLIGHT: "#F2E0A6",
  BLOOD: "#7A1414",
  BLOOD_DARK: "#3F0808",
  GOLD: "#C9A24A",
  GOLD_DARK: "#8C6A1F",
  BONE: "#EFE3C2",
  IRON: "#2B2B2B",
  WIN_GREEN: "#365E2A",
  LOSS_RED: "#7A1414",
  DRAW_GREY: "#5A5A5A",
} as const;

export type PaletteKey = keyof typeof PALETTE;

export function intToHex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0").toUpperCase();
}

export function parseHex(hex: string): RGB {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) {
    return [0, 0, 0];
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) {
    return [0, 0, 0];
  }
  return [r, g, b];
}

export function rgbToHex(rgb: RGB): string {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function setFillHex(doc: jsPDF, hex: string): void {
  const [r, g, b] = parseHex(hex);
  doc.setFillColor(r, g, b);
}

export function setDrawHex(doc: jsPDF, hex: string): void {
  const [r, g, b] = parseHex(hex);
  doc.setDrawColor(r, g, b);
}

export function setTextHex(doc: jsPDF, hex: string): void {
  const [r, g, b] = parseHex(hex);
  doc.setTextColor(r, g, b);
}

/** Mixe une couleur vers le blanc (factor=0 => identique, factor=1 => blanc). */
export function lighten(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  const f = Math.max(0, Math.min(1, factor));
  return rgbToHex([r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f]);
}

/** Mixe une couleur vers le noir (factor=0 => identique, factor=1 => noir). */
export function darken(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  const f = Math.max(0, Math.min(1, factor));
  return rgbToHex([r * (1 - f), g * (1 - f), b * (1 - f)]);
}

/** Luminance perceptuelle (0..1). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Si la couleur est trop proche du fond (delta luminance < threshold),
 * la fonce ou l'eclaircit pour garantir la lisibilite.
 */
export function ensureContrast(hex: string, bgHex: string, threshold = 0.3): string {
  const fg = luminance(hex);
  const bg = luminance(bgHex);
  if (Math.abs(fg - bg) >= threshold) return hex;
  return bg > 0.5 ? darken(hex, 0.45) : lighten(hex, 0.45);
}

export interface ResolvedTeamColors {
  primary: string;
  secondary: string;
  /** Variante 12% utilisee pour fond de cellules. */
  tint: string;
}

/**
 * Convertit les couleurs d'un roster (0xRRGGBB) en hex strings,
 * avec un fallback neutre + un tint clair derive du primary.
 */
export function resolveTeamColors(
  primaryInt: number | undefined,
  secondaryInt: number | undefined,
): ResolvedTeamColors {
  const primary = primaryInt !== undefined ? intToHex(primaryInt) : "#888888";
  const secondary = secondaryInt !== undefined ? intToHex(secondaryInt) : "#FFFFFF";
  return {
    primary,
    secondary,
    tint: lighten(primary, 0.78),
  };
}
