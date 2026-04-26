/**
 * Pure WCAG accessibility helpers (Q.21 — Sprint 23).
 *
 * Implementation conforme a la specification WCAG 2.x officielle :
 *   https://www.w3.org/TR/WCAG20-TECHS/G18.html
 *   https://www.w3.org/TR/WCAG21/#contrast-minimum
 *
 * - parseHexColor : "#RGB" / "#RRGGBB" / sans # -> { r, g, b }
 * - relativeLuminance : luminance relative WCAG (0..1)
 * - contrastRatio : ratio entre deux couleurs (1..21)
 * - meetsWCAG_AA : seuils 4.5 (texte normal) / 3.0 (texte large)
 * - meetsWCAG_AAA : seuils 7.0 (texte normal) / 4.5 (texte large)
 *
 * Reutilisable depuis tout script audit (CI a11y, dashboard, etc.).
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface WcagOptions {
  /** Si true, applique le seuil texte large (>=18pt regular ou 14pt bold). */
  large?: boolean;
}

const HEX_REGEX = /^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

export function parseHexColor(hex: string): RgbColor | null {
  if (typeof hex !== "string") return null;
  const match = HEX_REGEX.exec(hex.trim());
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

function channelLinearize(channel: number): number {
  // Channel ramene a [0, 1].
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: RgbColor): number {
  const r = channelLinearize(color.r);
  const g = channelLinearize(color.g);
  const b = channelLinearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(c1: string, c2: string): number {
  const a = parseHexColor(c1);
  const b = parseHexColor(c2);
  if (!a || !b) return Number.NaN;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAG_AA(c1: string, c2: string, opts: WcagOptions = {}): boolean {
  const ratio = contrastRatio(c1, c2);
  if (Number.isNaN(ratio)) return false;
  const threshold = opts.large ? 3 : 4.5;
  return ratio >= threshold;
}

export function meetsWCAG_AAA(
  c1: string,
  c2: string,
  opts: WcagOptions = {},
): boolean {
  const ratio = contrastRatio(c1, c2);
  if (Number.isNaN(ratio)) return false;
  const threshold = opts.large ? 4.5 : 7;
  return ratio >= threshold;
}
