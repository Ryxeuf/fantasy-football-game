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
  readonly displayName?: string | null;
  /** Coût d'embauche en kpo (`Position.cost`). */
  readonly cost?: number | null;
  readonly primarySkills?: string | null;
  readonly secondarySkills?: string | null;
  readonly skills?: string | null;
  readonly keywords?: string | null;
  readonly keywordsEn?: string | null;
  readonly imageUrl?: string | null;
}

export interface PositionMeta {
  /**
   * Libellé du poste servi par l'API (`Position.displayName`, localisé).
   * `null` si l'API ne le porte pas : l'appelant retombe alors sur le
   * catalogue compilé.
   */
  readonly displayName: string | null;
  /**
   * Coût d'embauche EN PO (`Position.cost` × 1000). `null` si absent.
   * C'est ce tarif que le serveur débite et qui alimente la VE : afficher
   * celui du catalogue compilé faisait diverger la colonne « Coût », la
   * carte PNG et le PDF de la VE servie par l'API.
   */
  readonly costPo: number | null;
  /** Slugs des compétences par défaut de la position (source DB). */
  readonly baseSkills: readonly string[];
  /** Mots-clés FR (CSV). */
  readonly keywords: string | null;
  /** Mots-clés EN (CSV). */
  readonly keywordsEn: string | null;
  /** Illustration du poste — portrait par défaut d'un joueur sans photo. */
  readonly imageUrl: string | null;
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
      displayName: pos.displayName ?? null,
      costPo: typeof pos.cost === "number" ? pos.cost * 1000 : null,
      baseSkills,
      keywords: pos.keywords ?? null,
      keywordsEn: pos.keywordsEn ?? null,
      imageUrl: pos.imageUrl ?? null,
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

/**
 * Résolveurs « base d'abord, catalogue en repli » dérivés d'une carte de
 * méta-postes. Les deux repli sur `@bb/game-engine` tant que le détail du
 * roster n'est pas chargé — jamais de case vide ni de slug brut à l'écran.
 */
export function makePositionResolvers(
  meta: ReadonlyMap<string, PositionMeta>,
  fallback: {
    readonly cost: (position: string, roster: string) => number;
    readonly displayName: (position: string) => string;
  },
): {
  readonly costPo: (position: string, roster: string) => number;
  readonly displayName: (position: string) => string;
} {
  return {
    costPo: (position, roster) =>
      meta.get(position)?.costPo ?? fallback.cost(position, roster),
    displayName: (position) =>
      meta.get(position)?.displayName || fallback.displayName(position),
  };
}
