/**
 * Indexation pure des accès compétences (primaire / secondaire) par slug de
 * position, pour la fiche d'équipe (`/me/teams/[id]`).
 *
 * Source : détail roster de l'API publique (`/api/rosters/:slug?ruleset=…`),
 * où chaque position porte `primarySkills` / `secondarySkills` (CSV de codes
 * G/A/S/P/M/K) dépendant du ruleset. On garde la logique hors du composant
 * pour rester testable sans rendu React.
 */

export interface PositionSkillAccess {
  readonly primary: string | null;
  readonly secondary: string | null;
}

export interface RosterPositionLike {
  readonly slug?: string | null;
  readonly primarySkills?: string | null;
  readonly secondarySkills?: string | null;
}

/**
 * Construit une Map `slug de position -> accès`. Les entrées sans slug
 * exploitable sont ignorées. Tolérant aux valeurs null/undefined (roster pas
 * encore chargé) pour pouvoir être appelé directement au rendu.
 */
export function buildSkillAccessByPosition(
  positions: ReadonlyArray<RosterPositionLike> | null | undefined,
): Map<string, PositionSkillAccess> {
  const map = new Map<string, PositionSkillAccess>();
  for (const pos of positions ?? []) {
    if (!pos || typeof pos.slug !== "string" || pos.slug.length === 0) {
      continue;
    }
    map.set(pos.slug, {
      primary: pos.primarySkills ?? null,
      secondary: pos.secondarySkills ?? null,
    });
  }
  return map;
}
