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
  readonly skills?: string | null;
  readonly keywords?: string | null;
  readonly keywordsEn?: string | null;
}

export interface PositionMeta {
  /** Slugs des compétences par défaut de la position (source DB). */
  readonly baseSkills: readonly string[];
  /** Mots-clés FR (CSV). */
  readonly keywords: string | null;
  /** Mots-clés EN (CSV). */
  readonly keywordsEn: string | null;
}

/**
 * Construit une Map `slug de position -> méta` (compétences de base DB +
 * mots-clés). Sert à distinguer base/acquise sans dépendre de la liste
 * hardcodée du game-engine, et à afficher les mots-clés.
 */
export function buildPositionMetaByPosition(
  positions: ReadonlyArray<RosterPositionLike> | null | undefined,
): Map<string, PositionMeta> {
  const map = new Map<string, PositionMeta>();
  for (const pos of positions ?? []) {
    if (!pos || typeof pos.slug !== "string" || pos.slug.length === 0) {
      continue;
    }
    const baseSkills = (pos.skills ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    map.set(pos.slug, {
      baseSkills,
      keywords: pos.keywords ?? null,
      keywordsEn: pos.keywordsEn ?? null,
    });
  }
  return map;
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
