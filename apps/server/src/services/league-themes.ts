/**
 * S26.6 — Catalogue canonique des themes saisonniers de ligue.
 *
 * Trois themes officiels :
 * - Skaven Cup        — mars
 * - Nordic Challenge  — avril
 * - Underworld Open   — mai
 *
 * Source : `docs/roadmap/sprints/S26-retention-engagement.md` (S26.6).
 *
 * Choix :
 * - Pas d'enum Prisma : on stocke un slug `string?` sur LeagueSeason pour
 *   rester compatible avec l'historique et permettre d'ajouter d'autres
 *   themes sans migration de schema.
 * - La verite metier (slugs valides, mois associe, couleur badge,
 *   description) vit ici, c'est cette source qui valide les inputs API
 *   et qui alimente l'UI calendrier.
 */

export type LeagueThemeSlug =
  | "skaven_cup"
  | "nordic_challenge"
  | "underworld_open";

export interface LeagueTheme {
  slug: LeagueThemeSlug;
  /** Titre public affiche en UI (e.g. "Skaven Cup"). */
  title: string;
  /** Mois canonique (1-12) pour la programmation automatique. */
  month: number;
  /** Couleur hex de la teinte badge / banniere. */
  badgeColor: string;
  /** Description courte affichee sur le calendrier `/leagues/seasons`. */
  description: string;
}

export const LEAGUE_THEMES: readonly LeagueTheme[] = Object.freeze([
  {
    slug: "skaven_cup",
    title: "Skaven Cup",
    month: 3,
    badgeColor: "#7a8c2c",
    description:
      "Edition de mars dediee aux equipes Skavens. Vitesse, ruse et morsures sous la lune.",
  },
  {
    slug: "nordic_challenge",
    title: "Nordic Challenge",
    month: 4,
    badgeColor: "#2c5d8c",
    description:
      "Edition d'avril pour les equipes nordiques et leurs alliees. Force brute en terrain glace.",
  },
  {
    slug: "underworld_open",
    title: "Underworld Open",
    month: 5,
    badgeColor: "#5e2c8c",
    description:
      "Edition de mai des bas-fonds : Underworld, Goblins et compagnies devoyees.",
  },
] as const);

const THEMES_BY_SLUG = new Map<string, LeagueTheme>(
  LEAGUE_THEMES.map((t) => [t.slug, t]),
);

const THEMES_BY_MONTH = new Map<number, LeagueTheme>(
  LEAGUE_THEMES.map((t) => [t.month, t]),
);

export function isLeagueThemeSlug(value: unknown): value is LeagueThemeSlug {
  return typeof value === "string" && THEMES_BY_SLUG.has(value);
}

export function getLeagueThemeBySlug(slug: string): LeagueTheme | null {
  if (typeof slug !== "string" || slug.length === 0) {
    return null;
  }
  return THEMES_BY_SLUG.get(slug) ?? null;
}

export function getLeagueThemeForMonth(month: number): LeagueTheme | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return THEMES_BY_MONTH.get(month) ?? null;
}

/**
 * Retourne une copie ordonnee par mois croissant. Ne mute jamais
 * `LEAGUE_THEMES`.
 */
export function listLeagueThemes(): LeagueTheme[] {
  return [...LEAGUE_THEMES].sort((a, b) => a.month - b.month);
}

/**
 * Format public du badge profil "Champion {Theme} {YYYY}".
 * Retourne null si le slug ou l'annee sont invalides.
 */
export function formatLeagueThemeChampionLabel(
  slug: LeagueThemeSlug,
  year: number,
): string | null {
  const theme = getLeagueThemeBySlug(slug);
  if (!theme) return null;
  if (!Number.isInteger(year) || year <= 0) return null;
  return `Champion ${theme.title} ${year}`;
}
