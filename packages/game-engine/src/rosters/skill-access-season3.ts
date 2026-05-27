/**
 * Accès compétences Primaire/Secondaire par position — BB Season 3.
 *
 * Pourquoi
 * --------
 * `PositionDefinition` (positions.ts) ne porte que les compétences de DÉPART.
 * L'accès en montée de niveau (catégories où le joueur peut piocher : primaire
 * vs secondaire) est encodé ici, à part, pour garder positions.ts stable et
 * isoler la donnée + sa normalisation.
 *
 * Format
 * ------
 *  - Clé   : slug de position (ex: "dwarf_runner"), aligné sur positions.ts.
 *  - primary / secondary : CSV de codes catégorie canoniques `G/A/S/P/M`.
 *    - `""` = pool vide renseigné (ex: positions animales sans accès primaire).
 *  - Une position ABSENTE de ce map → accès non renseigné (champ DB `null`),
 *    la validation de level-up est alors désactivée pour elle.
 *
 * Source
 * ------
 * Généré depuis `data/saison3/team/*.md` (colonnes Primaire/Secondaire) via
 * `scripts/generate-skill-access-season3.ts`. La source mélange la notation
 * française `F` (Force) et anglaise `S` (Strength) pour la même catégorie :
 * le générateur normalise `F → S`. NE PAS éditer à la main hors corrections
 * ciblées (errata) — relancer le générateur.
 *
 * Ruleset : season_3 uniquement (season_2 sans source autoritaire).
 */

export interface PositionSkillAccessS3 {
  /** CSV codes catégorie accessibles en primaire (ex: "G,S"). "" = vide. */
  readonly primary: string;
  /** CSV codes catégorie accessibles en secondaire (ex: "A"). "" = vide. */
  readonly secondary: string;
}

/**
 * Rempli par C3 (`scripts/generate-skill-access-season3.ts`).
 * Stub vide pour C1 → toutes les positions season_3 restent `null` en DB
 * tant que les données ne sont pas générées (validation désactivée).
 */
export const SKILL_ACCESS_SEASON3: Record<string, PositionSkillAccessS3> = {};
