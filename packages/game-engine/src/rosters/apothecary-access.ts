/**
 * Accès à l'apothicaire par roster (règle officielle Blood Bowl).
 *
 * Les équipes mort-vivantes ne peuvent PAS recruter d'apothicaire :
 * leurs joueurs ne sont pas soignables par un apothicaire (régénération
 * à la place). Source unique de vérité consommée par le builder web, la
 * page d'équipe (achat en trésorerie) et le serveur (refus création +
 * achat).
 *
 * Slugs canoniques alignés sur `season3-rosters.ts` / `positions.ts`.
 * Les alias legacy (pré-migration underscore) sont résolus via la même
 * logique que `reroll-costs.ts` avant lookup.
 */

import { resolveRosterSlugForReroll } from './reroll-costs';

/**
 * Rosters mort-vivants interdits d'apothicaire (slugs canoniques).
 *
 * - `necromantic_horror` (alias legacy : `necromantic`)
 * - `undead`
 * - `tomb_kings` (alias legacy : `tombkings`)
 * - `nurgle`
 */
export const APOTHECARY_FORBIDDEN_ROSTERS: ReadonlySet<string> = new Set([
  'necromantic_horror',
  'undead',
  'tomb_kings',
  'nurgle',
]);

/**
 * Indique si un roster peut recruter un apothicaire.
 *
 * Le slug est d'abord résolu via les alias legacy (réutilise
 * `resolveRosterSlugForReroll`) afin que `necromantic`/`tombkings`
 * soient traités comme leurs équivalents canoniques.
 *
 * @param rosterSlug slug du roster (canonique ou legacy)
 * @returns `false` pour les équipes mort-vivantes, `true` sinon
 */
export function canRosterHaveApothecary(rosterSlug: string): boolean {
  const slug = resolveRosterSlugForReroll(rosterSlug);
  return !APOTHECARY_FORBIDDEN_ROSTERS.has(slug);
}
