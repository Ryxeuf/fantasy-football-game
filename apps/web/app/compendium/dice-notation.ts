import type { BlockDieFace } from "../components/dice/types";
import { BLOCK_DIE_FACE_ARIA } from "../components/dice/labels";

/**
 * Lecture des NOTATIONS de dés des tables du compendium — module PUR.
 *
 * Les tables de règles portent leur dé dans l'en-tête de colonne (« 2D6 »,
 * « D16 », « 1ᵉʳ D6 ») et le résultat dans la cellule (« 9 », « 2-7 »).
 * Plutôt que d'ajouter au JSON une annotation de présentation qui
 * pourrait dériver du texte, le rendu RELIT ces notations : une colonne
 * reconnue affiche ses jets en faces de dés, tout le reste reste du texte.
 *
 * Ce qui n'est pas reconnu (cellule vide, « Aucun jet », plage hors des
 * bornes du dé) retombe sur le texte : on n'invente jamais une face.
 */

/** Dé d'une colonne de jets. */
export type DiceColumn =
  /** Un D6 : faces à points, une par valeur de la plage. */
  | { readonly kind: "d6" }
  /** Un dé chiffré (D3, D8, D16) : bornes de la plage en faces chiffrées. */
  | { readonly kind: "number"; readonly sides: number }
  /** Somme de plusieurs dés (2D6) : total chiffré, sans nombre de faces. */
  | { readonly kind: "sum"; readonly count: number; readonly sides: number };

/** Plage de résultats inclusive (« 9 » = 9-9). */
export interface RollRange {
  readonly from: number;
  readonly to: number;
}

/**
 * Faces de dé que le livre utilise. Un « D7 » ou un « D100 » serait une
 * coquille de transcription, pas un dé à dessiner.
 */
const SUPPORTED_SIDES = new Set([3, 6, 8, 16]);

/** « 2D6 », « D16 », « 1ᵉʳ D6 », « 2ᵉ D6 » (rang ordinal ignoré). */
const HEADER_RE = /^(?:\d+\s*(?:ᵉʳ|ᵉ|er|e|re)\s+)?(\d*)\s*D(\d+)$/i;

/** Reconnaît le dé d'un en-tête de colonne ; `null` sinon. */
export function parseDiceColumn(header: string): DiceColumn | null {
  const match = HEADER_RE.exec(header.trim());
  if (!match) return null;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  if (!SUPPORTED_SIDES.has(sides) || count < 1 || count > 3) return null;
  if (count > 1) return { kind: "sum", count, sides };
  return sides === 6 ? { kind: "d6" } : { kind: "number", sides };
}

/** Bornes atteignables par le dé d'une colonne. */
export function diceColumnBounds(column: DiceColumn): RollRange {
  switch (column.kind) {
    case "d6":
      return { from: 1, to: 6 };
    case "number":
      return { from: 1, to: column.sides };
    case "sum":
      return { from: column.count, to: column.count * column.sides };
  }
}

/** « 9 », « 2-7 », « 15 – 16 » (tiret court ou demi-cadratin). */
const RANGE_RE = /^(\d+)(?:\s*[-–]\s*(\d+))?$/;

/**
 * Lit la plage d'une cellule de jet pour le dé de sa colonne. `null` si la
 * cellule n'est pas une plage, si elle est inversée ou hors des bornes du
 * dé : la cellule s'affichera alors telle quelle.
 */
export function parseRollRange(cell: string, column: DiceColumn): RollRange | null {
  const match = RANGE_RE.exec(cell.trim());
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : from;
  const bounds = diceColumnBounds(column);
  if (from > to || from < bounds.from || to > bounds.to) return null;
  return { from, to };
}

/** Valeurs d'une plage, bornes comprises (« 2-5 » → 2, 3, 4, 5). */
export function rangeValues(range: RollRange): number[] {
  return Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i);
}

/** Libellé lisible d'une plage (« 2 à 7 », « 9 ») pour les lecteurs d'écran. */
export function rangeLabel(range: RollRange): string {
  return range.from === range.to ? String(range.from) : `${range.from} à ${range.to}`;
}

/**
 * Nom du dé d'une colonne, tel qu'on l'annonce (« D6 », « 2D6 », « D16 »).
 * Sert de libellé accessible aux faces : « 2D6 : 7 ».
 */
export function diceColumnName(column: DiceColumn): string {
  switch (column.kind) {
    case "d6":
      return "D6";
    case "number":
      return `D${column.sides}`;
    case "sum":
      return `${column.count}D${column.sides}`;
  }
}

const BLOCK_FACE_BY_NAME: ReadonlyMap<string, BlockDieFace> = new Map(
  (Object.entries(BLOCK_DIE_FACE_ARIA.fr) as Array<[BlockDieFace, string]>).map(
    ([face, name]) => [normalizeName(name), face],
  ),
);

function normalizeName(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Face du Dé de Blocage portant ce nom OFFICIEL (« Défenseur Plaqué »…),
 * casse et accents ignorés ; `null` pour tout autre texte. Une cellule qui
 * NOMME un résultat du dé s'illustre de sa face.
 */
export function blockFaceForName(text: string): BlockDieFace | null {
  return BLOCK_FACE_BY_NAME.get(normalizeName(text)) ?? null;
}
