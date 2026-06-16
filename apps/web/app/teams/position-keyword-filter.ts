/**
 * Helpers purs pour le filtre de positions par mot-clé (lignée + type).
 * Sans I/O ni React → testables unitairement. Le composant client
 * `PositionKeywordBrowser` les consomme.
 */

import type { ListedPosition } from "./position-rankings";

/** Normalise un token pour comparaison (casse/accents/tirets tolérants). */
export function normalizeKeyword(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-\s]+/g, " ")
    .trim();
}

/** Mots-clés d'une position dans la langue voulue (FR par défaut). */
export function positionKeywords(
  position: Pick<ListedPosition, "keywords" | "keywordsEn">,
  lang: string,
): string[] {
  const csv =
    lang === "en" ? position.keywordsEn ?? position.keywords : position.keywords;
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Liste triée des mots-clés distincts présents dans les positions (langue
 * donnée), dédoublonnée de façon insensible à la casse/aux variantes (la
 * première graphie rencontrée sert de libellé affiché).
 */
export function collectKeywordOptions(
  positions: ReadonlyArray<Pick<ListedPosition, "keywords" | "keywordsEn">>,
  lang: string,
): string[] {
  const byNorm = new Map<string, string>();
  for (const p of positions) {
    for (const kw of positionKeywords(p, lang)) {
      const norm = normalizeKeyword(kw);
      if (!byNorm.has(norm)) byNorm.set(norm, kw);
    }
  }
  return [...byNorm.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Filtre les positions : une position passe si elle contient TOUS les
 * mots-clés actifs (ET logique), comparaison normalisée. `active` vide ⇒
 * toutes les positions.
 */
export function filterPositionsByKeywords<
  T extends Pick<ListedPosition, "keywords" | "keywordsEn">,
>(positions: ReadonlyArray<T>, active: ReadonlyArray<string>, lang: string): T[] {
  if (active.length === 0) return [...positions];
  const wanted = active.map(normalizeKeyword);
  return positions.filter((p) => {
    const have = new Set(positionKeywords(p, lang).map(normalizeKeyword));
    return wanted.every((w) => have.has(w));
  });
}
