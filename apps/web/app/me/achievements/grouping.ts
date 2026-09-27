/**
 * Regroupement des succès par catégorie, pour `/me/achievements` (pur).
 */

export type AchievementCategory =
  | "matches"
  | "scoring"
  | "casualties"
  | "social"
  | "rosters"
  | "leagues"
  | "predictions";

export const CATEGORY_LABELS: Readonly<Record<AchievementCategory, string>> = {
  matches: "Matchs",
  scoring: "Touchdowns",
  casualties: "Sorties",
  social: "Social",
  rosters: "Équipes prioritaires",
  leagues: "Ligues",
  predictions: "Pronostics",
};

const KNOWN_CATEGORIES = Object.keys(CATEGORY_LABELS) as AchievementCategory[];
const OTHER_CATEGORY = "other";

export interface AchievementGroup<T> {
  readonly key: string;
  readonly label: string;
  readonly items: readonly T[];
}

/**
 * Regroupe par catégorie, dans l'ordre d'affichage. Tolérant : une catégorie
 * que le web ne connaît pas encore (serveur déployé avant lui) tombe dans
 * « Autres » au lieu de faire planter la page.
 */
export function groupAchievements<T extends { readonly category: string }>(
  achievements: readonly T[],
): AchievementGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const ach of achievements) {
    const key = (KNOWN_CATEGORIES as readonly string[]).includes(ach.category)
      ? ach.category
      : OTHER_CATEGORY;
    buckets.set(key, [...(buckets.get(key) ?? []), ach]);
  }
  return [...KNOWN_CATEGORIES, OTHER_CATEGORY]
    .filter((key) => (buckets.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      label:
        key === OTHER_CATEGORY
          ? "Autres"
          : CATEGORY_LABELS[key as AchievementCategory],
      items: buckets.get(key) ?? [],
    }));
}
