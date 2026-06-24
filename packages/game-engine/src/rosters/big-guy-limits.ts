/**
 * A36 — Plafond COMBINÉ de Gros Bras (Big Guy) par équipe.
 *
 * Contrairement aux `max` par position (déjà gérés à la sélection), certaines
 * équipes plafonnent le nombre TOTAL de Gros Bras (tous types confondus)
 * qu'elles peuvent aligner. Ce plafond est une règle distincte du `max` de
 * chaque poste : un roster peut proposer 4 postes Gros Bras `max: 1` mais ne
 * pas autoriser plus de N Gros Bras au total.
 *
 * Plafonds officiels :
 *  - `old_world_alliance` (Alliance du Vieux Monde) : 1
 *  - `underworld` (Bas-Fond) : 1
 *  - `chaos_chosen` (Élus du Chaos) : 1
 *  - `chaos_renegade` (Renégats du Chaos) : 3
 *
 * Les autres équipes n'ont pas de plafond combiné spécifique (elles s'appuient
 * sur les `max` par poste) → `null`.
 *
 * 100 % pur, sans I/O. La détection d'un poste Gros Bras se fait ailleurs via
 * `isBigGuy(position)` (cf. `formats.ts`).
 */

import { resolveRosterSlugForReroll } from "./reroll-costs";

/**
 * Plafonds combinés de Gros Bras par slug canonique d'équipe.
 * Absence de clé = pas de plafond combiné spécifique.
 */
const BIG_GUY_COMBINED_LIMITS: Readonly<Record<string, number>> = {
  old_world_alliance: 1,
  underworld: 1,
  chaos_chosen: 1,
  chaos_renegade: 3,
};

/**
 * Renvoie le plafond COMBINÉ de Gros Bras pour un roster, ou `null` si l'équipe
 * n'a pas de plafond combiné spécifique (elle s'appuie alors sur les `max` par
 * poste).
 *
 * Gère les alias legacy (slugs pré-migration underscore) via
 * `resolveRosterSlugForReroll` afin de rester cohérent avec le reste des
 * lookups par roster.
 *
 * @param rosterSlug - Slug de l'équipe (canonique ou legacy).
 */
export function bigGuyLimitForRoster(rosterSlug: string): number | null {
  const slug = resolveRosterSlugForReroll(rosterSlug);
  return BIG_GUY_COMBINED_LIMITS[slug] ?? null;
}
