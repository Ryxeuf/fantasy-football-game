/**
 * Critères de classement d'une saison de ligue (départages), configurables
 * par le commissaire à la création puis par un administrateur — pendant
 * exact de `services/cup-standings-order` côté coupe.
 *
 * Le tri vivait au milieu de `services/league.ts` (~1400 lignes, Prisma
 * partout) : impossible à relire, et son ordre par défaut ignorait deux des
 * colonnes que le classement AFFICHE pourtant depuis F1 — les points bonus
 * (`Bo`, comptés à part de `points`) et les forfaits (`For`). Deux équipes
 * à égalité de points étaient donc départagées à la différence de TD alors
 * que l'une avait des bonus et l'autre un forfait.
 *
 * Ce module est 100 % PUR : il ne connaît ni Prisma, ni la forme de la
 * colonne, ni Express. `parseLeagueTieBreakRules` accepte la chaîne JSON
 * stockée (`League.tieBreakRules` est un `String?`), l'array déjà
 * désérialisé, et le `null` des ligues antérieures à la colonne — aucun
 * backfill n'est possible ici (`prisma/migrations/` est gitignoré, la prod
 * applique `db push`), donc l'absence DOIT rester lisible et retomber sur
 * l'ordre par défaut.
 */

/**
 * Ligne minimale dont le comparateur a besoin : un sous-ensemble de
 * `StandingRow`. Les champs optionnels sont ceux ajoutés après coup à
 * l'API (rétro-compat) — ils sont lus avec un repli, jamais supposés.
 */
export interface LeagueStandingRowForOrder {
  readonly teamName: string;
  readonly played: number;
  readonly wins: number;
  readonly points: number;
  readonly touchdownsFor: number;
  readonly touchdownsAgainst: number;
  readonly touchdownDifference: number;
  readonly casualtiesFor: number;
  readonly casualtiesAgainst: number;
  readonly seasonElo: number;
  /** E2 — sous-total de points bonus, compté À PART de `points`. */
  readonly bonusPoints?: number;
  /** F1 — points retirés par les forfaits (`forfaits × League.forfeitPoints`). */
  readonly forfeitPoints?: number;
  /** F1 — différentiel de sorties, pré-calculé côté service. */
  readonly casualtyDifference?: number;
}

/**
 * Slugs de départage supportés. `name` est toujours ASC (sentinelle de
 * queue, garantit un ordre total) ; `td_against` et `cas_against` sont
 * « moins il y en a, mieux c'est » ; tous les autres sont DESC.
 *
 * `forfeit_points` trie la colonne « For » (des points RETIRÉS, donc
 * négatifs) en DÉCROISSANT : zéro forfait passe devant un forfait, deux
 * forfaits derrière un seul. C'est bien le sens sportif, et il reste juste
 * si une ligue configure un barème de forfait positif.
 */
export const LEAGUE_TIE_BREAK_SLUGS = [
  "points",
  "bonus_points",
  "forfeit_points",
  "td_diff",
  "td_for",
  "td_against",
  "cas_diff",
  "cas_for",
  "cas_against",
  "season_elo",
  "wins",
  "played",
  "name",
] as const;

export type LeagueTieBreakSlug = (typeof LEAGUE_TIE_BREAK_SLUGS)[number];

/**
 * Ordre appliqué à toute ligue qui ne configure rien : points, bonus,
 * forfaits, différence de TD, différence de sorties — c'est-à-dire les
 * colonnes que le tableau met en tête, dans l'ordre où un coach les lit.
 *
 * L'ELO n'y figure pas : non pertinent pour une ligue fermée (saisie
 * offline). Une ligue peut le réactiver en l'ajoutant à ses critères, ce
 * qui rallume aussi sa colonne (`isSeasonEloRanked`).
 */
export const DEFAULT_LEAGUE_TIE_BREAK_RULES: readonly LeagueTieBreakSlug[] = [
  "points",
  "bonus_points",
  "forfeit_points",
  "td_diff",
  "cas_diff",
  "name",
];

function isSlug(value: unknown): value is LeagueTieBreakSlug {
  return (
    typeof value === "string" &&
    (LEAGUE_TIE_BREAK_SLUGS as readonly string[]).includes(value)
  );
}

/**
 * Garde l'ordre saisi, retire l'inconnu et les doublons, pousse `name` en
 * sentinelle de queue. Retourne `null` quand il ne reste rien
 * d'exploitable — l'appelant retombe alors sur le défaut.
 */
function sanitize(input: unknown): LeagueTieBreakSlug[] | null {
  if (!Array.isArray(input)) return null;
  const valid: LeagueTieBreakSlug[] = [];
  for (const item of input) {
    if (isSlug(item) && !valid.includes(item)) valid.push(item);
  }
  if (valid.length === 0) return null;
  if (!valid.includes("name")) valid.push("name");
  return valid;
}

/**
 * Parse tolérant de `League.tieBreakRules` : chaîne JSON (colonne
 * `String?`), array déjà désérialisé, `null`/`undefined` ou contenu
 * corrompu. Renvoie TOUJOURS une liste applicable.
 */
export function parseLeagueTieBreakRules(
  raw: unknown,
): readonly LeagueTieBreakSlug[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return DEFAULT_LEAGUE_TIE_BREAK_RULES;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_LEAGUE_TIE_BREAK_RULES;
    }
  }
  return sanitize(parsed) ?? DEFAULT_LEAGUE_TIE_BREAK_RULES;
}

/**
 * Normalise une liste saisie (création / édition) avant persistance.
 * `null` signifie « aucun critère retenu » : la colonne repart à `null` et
 * le classement retombe sur l'ordre par défaut.
 */
export function normalizeLeagueTieBreakRules(
  input: readonly string[] | null | undefined,
): LeagueTieBreakSlug[] | null {
  if (!input) return null;
  return sanitize(input);
}

/**
 * Sérialise pour la colonne `String?`. `null` = pas de configuration.
 */
export function serializeLeagueTieBreakRules(
  input: readonly string[] | null | undefined,
): string | null {
  const normalized = normalizeLeagueTieBreakRules(input);
  return normalized ? JSON.stringify(normalized) : null;
}

/**
 * Vrai si l'ELO saisonnier est un critère de classement EFFECTIF pour cette
 * ligue. Pilote l'affichage de la colonne ELO : masquée par défaut,
 * « réactivable via réglages » en ajoutant `season_elo`.
 */
export function isSeasonEloRanked(raw: unknown): boolean {
  return parseLeagueTieBreakRules(raw).includes("season_elo");
}

function casualtyDiff(row: LeagueStandingRowForOrder): number {
  return row.casualtyDifference ?? row.casualtiesFor - row.casualtiesAgainst;
}

function compareBySlug(
  a: LeagueStandingRowForOrder,
  b: LeagueStandingRowForOrder,
  slug: LeagueTieBreakSlug,
): number {
  switch (slug) {
    case "points":
      return b.points - a.points;
    case "bonus_points":
      return (b.bonusPoints ?? 0) - (a.bonusPoints ?? 0);
    case "forfeit_points":
      // Colonne « For » : des points retirés (négatifs). DÉCROISSANT, donc
      // 0 forfait devant 1 forfait devant 2.
      return (b.forfeitPoints ?? 0) - (a.forfeitPoints ?? 0);
    case "td_diff":
      return b.touchdownDifference - a.touchdownDifference;
    case "td_for":
      return b.touchdownsFor - a.touchdownsFor;
    case "td_against":
      // Moins de TD encaissés = mieux classé.
      return a.touchdownsAgainst - b.touchdownsAgainst;
    case "cas_diff":
      return casualtyDiff(b) - casualtyDiff(a);
    case "cas_for":
      return b.casualtiesFor - a.casualtiesFor;
    case "cas_against":
      // Moins de sorties subies = mieux classé.
      return a.casualtiesAgainst - b.casualtiesAgainst;
    case "season_elo":
      return b.seasonElo - a.seasonElo;
    case "wins":
      return b.wins - a.wins;
    case "played":
      // Plus de matchs joués = mieux classé (une équipe en retard ne double
      // pas celle qui a fait le travail, à points égaux).
      return b.played - a.played;
    case "name":
      return a.teamName.localeCompare(b.teamName);
  }
}

/**
 * Comparateur `Array.prototype.sort` pour un classement de ligue.
 * Pur : testable sans Prisma.
 */
export function makeLeagueStandingsComparator(
  rules: readonly LeagueTieBreakSlug[],
): (a: LeagueStandingRowForOrder, b: LeagueStandingRowForOrder) => number {
  return (a, b) => {
    for (const slug of rules) {
      const cmp = compareBySlug(a, b, slug);
      if (cmp !== 0) return cmp;
    }
    return 0;
  };
}
