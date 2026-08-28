/**
 * Cache du catalogue public de compétences (`GET /api/skills`).
 *
 * Le namespace de mémoïsation vit ICI, et non dans la route, pour que le
 * code métier puisse purger le cache sans importer un module Express
 * (un service qui importe une route crée un cycle et embarque le Router).
 *
 * Même posture que `invalidateRosterCache` / `invalidateInducementsCache` :
 * TTL court côté lecture + purge explicite à chaque écriture d'une ligne
 * `Skill`.
 */

import { invalidateMemoNamespace } from "./memoize-async";

/** Namespace `memoizeAsync` du catalogue public. */
export const SKILLS_CACHE_NS = "public-skills";

/** TTL du catalogue public (5 min). */
export const SKILLS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Vide le cache du catalogue de compétences.
 *
 * À appeler après TOUTE création/édition d'une ligne `Skill` — sinon la
 * nouvelle compétence reste invisible jusqu'à 5 min. Cas réel : « Haine (X) »
 * est créée à la volée à la validation d'une feuille de match
 * (`services/league-hate-trait`), et le badge posé sur le joueur s'affichait
 * en slug brut (`hate-homme-lezard`) tant que le cache n'avait pas expiré.
 */
export function invalidatePublicSkillsCache(): void {
  invalidateMemoNamespace(SKILLS_CACHE_NS);
}
