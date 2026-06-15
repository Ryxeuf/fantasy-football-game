/**
 * Logique pure (sans React ni fetch) pour les "études" de positions :
 *   - B.6 : classements dérivés des seules stats statiques (les plus rapides,
 *     les plus forts, les plus blindés, les plus agiles, les meilleurs
 *     passeurs, les moins chères) ;
 *   - B.7 : helpers du comparateur de positions (parse des ids, meilleure
 *     valeur par stat pour le surlignage).
 *
 * Source : `GET /api/positions?ruleset=season_3` (toutes les positions à plat
 * avec leur roster). 100 % testable sans Prisma ni rendu.
 *
 * Sémantique BB2020 : MA/ST/AV → plus haut = mieux ; AG/PA sont des seuils de
 * jet (« 3+ ») → plus bas = mieux ; coût → plus bas = moins cher.
 */

export interface ListedPosition {
  readonly slug: string;
  readonly displayName: string;
  readonly displayNameEn?: string | null;
  readonly rosterSlug: string;
  readonly rosterName: string;
  readonly cost: number;
  readonly min: number;
  readonly max: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number;
  readonly av: number;
  readonly skills: string;
}

export type StatKey = "ma" | "st" | "ag" | "pa" | "av" | "cost";
export type RankDir = "asc" | "desc";

export interface Leaderboard {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly key: StatKey;
  readonly dir: RankDir;
  /** Formate la valeur de la stat pour l'affichage. */
  readonly format: (value: number) => string;
  /** Filtre les positions éligibles (ex : exclure pa = 0 « ne passe pas »). */
  readonly eligible?: (p: ListedPosition) => boolean;
}

export const LEADERBOARDS: readonly Leaderboard[] = [
  {
    id: "fastest",
    title: "Les plus rapides",
    subtitle: "Mouvement (MA) le plus élevé",
    key: "ma",
    dir: "desc",
    format: (v) => `MA ${v}`,
  },
  {
    id: "strongest",
    title: "Les plus forts",
    subtitle: "Force (ST) la plus élevée",
    key: "st",
    dir: "desc",
    format: (v) => `ST ${v}`,
  },
  {
    id: "toughest",
    title: "Les plus blindés",
    subtitle: "Armure (AV) la plus élevée",
    key: "av",
    dir: "desc",
    format: (v) => `AV ${v}+`,
  },
  {
    id: "agile",
    title: "Les plus agiles",
    subtitle: "Agilité (AG) la plus basse = la meilleure",
    key: "ag",
    dir: "asc",
    format: (v) => `AG ${v}+`,
    eligible: (p) => p.ag > 0,
  },
  {
    id: "passers",
    title: "Les meilleurs passeurs",
    subtitle: "Passe (PA) la plus basse = la meilleure",
    key: "pa",
    dir: "asc",
    format: (v) => `PA ${v}+`,
    eligible: (p) => p.pa > 0,
  },
  {
    id: "cheapest",
    title: "Les moins chères",
    subtitle: "Coût le plus bas",
    key: "cost",
    dir: "asc",
    format: (v) => `${v}k po`,
    eligible: (p) => p.cost > 0,
  },
];

/**
 * Trie les positions selon un classement et renvoie les `limit` premières.
 * Départage stable : à stat égale, la moins chère puis l'ordre alphabétique.
 */
export function rankPositions(
  positions: readonly ListedPosition[],
  board: Leaderboard,
  limit: number,
): ListedPosition[] {
  const eligible = board.eligible
    ? positions.filter(board.eligible)
    : [...positions];
  const sorted = eligible.sort((a, b) => {
    const diff =
      board.dir === "desc"
        ? b[board.key] - a[board.key]
        : a[board.key] - b[board.key];
    if (diff !== 0) return diff;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.displayName.localeCompare(b.displayName);
  });
  return sorted.slice(0, limit);
}

/** Parse une CSV de slugs (lien partagé `?ids=`) : trim, sans vides, cappé. */
export function parsePositionIds(
  raw: string | undefined,
  max: number,
): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}

/**
 * Meilleure valeur d'un stat parmi des positions (pour surligner la colonne
 * gagnante dans le comparateur). `null` si la liste est vide.
 */
export function bestStatValue(
  positions: readonly ListedPosition[],
  key: StatKey,
  dir: RankDir,
): number | null {
  if (positions.length === 0) return null;
  return positions.reduce((best, p) => {
    const v = p[key];
    if (dir === "desc") return v > best ? v : best;
    return v < best ? v : best;
  }, positions[0][key]);
}
