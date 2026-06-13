/**
 * Helpers purs pour les slugs de comparaison `/teams/comparer/[matchup]`.
 *
 * Un « matchup » est de la forme `skaven-vs-orc`. Les slugs de roster
 * utilisent des underscores (`old_world_alliance`, `chaos_chosen`) et jamais
 * le séparateur littéral `-vs-`, ce qui rend le découpage non ambigu.
 *
 * ANTI-CONTENU MINCE : on canonicalise l'ordre des deux slugs (ordre
 * alphabétique). `skaven-vs-orc` et `orc-vs-skaven` désignent la même
 * comparaison ; seule la version canonique (`orc-vs-skaven`) doit être
 * indexée. La page redirige les variantes non canoniques et pointe toujours
 * le canonical vers la version triée.
 */

export const MATCHUP_SEPARATOR = "-vs-";

export interface ParsedMatchup {
  readonly a: string;
  readonly b: string;
}

/** Forme d'un slug de roster valide : minuscules, chiffres, underscores. */
const SLUG_RE = /^[a-z0-9_]+$/;

/**
 * Découpe un paramètre `matchup` en deux slugs. Retourne `null` si le format
 * est invalide (séparateur absent, slug vide, slugs identiques, caractères
 * interdits). Ne valide PAS l'existence des rosters — c'est le rôle de la
 * page (qui 404 via l'API).
 */
export function parseMatchup(param: string | undefined | null): ParsedMatchup | null {
  if (!param) return null;
  const parts = param.split(MATCHUP_SEPARATOR);
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!a || !b) return null;
  if (!SLUG_RE.test(a) || !SLUG_RE.test(b)) return null;
  if (a === b) return null;
  return { a, b };
}

/** Construit le slug de matchup canonique (ordre alphabétique des slugs). */
export function canonicalMatchup(a: string, b: string): string {
  return [a, b].sort().join(MATCHUP_SEPARATOR);
}

/**
 * Indique si un paramètre `matchup` est déjà sous sa forme canonique.
 * Retourne `false` pour un format invalide.
 */
export function isCanonicalMatchup(param: string | undefined | null): boolean {
  const parsed = parseMatchup(param);
  if (!parsed) return false;
  return param === canonicalMatchup(parsed.a, parsed.b);
}
