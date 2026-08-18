/**
 * Helpers purs pour le filtre de positions par mot-clé (lignée + type).
 *
 * L'implémentation est partagée avec les Star Players : elle vit dans
 * `app/lib/keyword-filter.ts`. Ce module conserve les noms historiques
 * (consommés par `PositionKeywordBrowser`) et fige les types côté position.
 */

import type { ListedPosition } from "./position-rankings";
import {
  collectKeywordOptions as collectKeywordOptionsGeneric,
  entityKeywords,
  filterByKeywords,
  normalizeKeyword,
} from "../lib/keyword-filter";

export { normalizeKeyword };

type PositionKeywords = Pick<ListedPosition, "keywords" | "keywordsEn">;

/** Mots-clés d'une position dans la langue voulue (FR par défaut). */
export function positionKeywords(
  position: PositionKeywords,
  lang: string,
): string[] {
  return entityKeywords(position, lang);
}

/** Liste triée des mots-clés distincts présents dans les positions. */
export function collectKeywordOptions(
  positions: ReadonlyArray<PositionKeywords>,
  lang: string,
): string[] {
  return collectKeywordOptionsGeneric(positions, lang);
}

/**
 * Filtre les positions : une position passe si elle contient TOUS les
 * mots-clés actifs (ET logique), comparaison normalisée. `active` vide ⇒
 * toutes les positions.
 */
export function filterPositionsByKeywords<T extends PositionKeywords>(
  positions: ReadonlyArray<T>,
  active: ReadonlyArray<string>,
  lang: string,
): T[] {
  return filterByKeywords(positions, active, lang);
}
