/**
 * Critères de classement d'une coupe (départages), configurables par le
 * commissaire — miroir de `League.tieBreakRules` côté ligue.
 *
 * Le classement d'une coupe était trié par un comparateur EN DUR
 * (`cupScoring.ts`) : points → diff TD → TD pour → victoires → nom. Deux
 * coupes ne pouvaient donc pas départager différemment, alors que le barème
 * de points, lui, est déjà entièrement paramétrable. Un règlement de tournoi
 * qui départage à la « BASH » (sorties infligées) ou aux TD encaissés était
 * impossible à exprimer.
 *
 * Ce module est 100 % PUR : il ne connaît ni Prisma ni la forme de la
 * colonne. `parseCupTieBreakRules` accepte la chaîne JSON stockée, l'array
 * natif (PG) et le `null` des coupes antérieures à la colonne — aucun
 * backfill n'est possible ici (`prisma/migrations/` est gitignoré, la prod
 * applique `db push`), donc l'absence DOIT rester lisible et retomber sur
 * l'ordre historique.
 */

/** Ligne minimale dont le comparateur a besoin (sous-ensemble de `CupTeamStats`). */
export interface CupStandingRowForOrder {
  readonly teamName: string;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly byes: number;
  readonly matchesPlayed: number;
  readonly touchdownsFor: number;
  readonly touchdownsAgainst: number;
  readonly touchdownDiff: number;
  readonly passes: number;
  readonly totalCasualtiesFor: number;
  readonly totalCasualtiesAgainst: number;
  readonly resultPoints: number;
  readonly actionPoints: number;
  readonly totalPoints: number;
}

/**
 * Slugs de départage supportés. `name` est toujours ASC (sentinelle de
 * queue, garantit un ordre total) ; `td_against` et `cas_against` sont
 * « moins il y en a, mieux c'est » ; tous les autres sont DESC.
 */
export const CUP_TIE_BREAK_SLUGS = [
  "points",
  "result_points",
  "action_points",
  "wins",
  "td_diff",
  "td_for",
  "td_against",
  "cas_diff",
  "cas_for",
  "cas_against",
  "passes",
  "played",
  "name",
] as const;

export type CupTieBreakSlug = (typeof CUP_TIE_BREAK_SLUGS)[number];

/**
 * Ordre historique du classement de coupe, conservé tel quel pour toutes
 * les coupes qui ne configurent rien (y compris celles d'avant la colonne).
 */
export const DEFAULT_CUP_TIE_BREAK_RULES: readonly CupTieBreakSlug[] = [
  "points",
  "td_diff",
  "td_for",
  "wins",
  "name",
];

function isSlug(value: unknown): value is CupTieBreakSlug {
  return (
    typeof value === "string" &&
    (CUP_TIE_BREAK_SLUGS as readonly string[]).includes(value)
  );
}

/**
 * Parse tolérant de `Cup.tieBreakRules` : chaîne JSON (colonne `String?`),
 * array déjà désérialisé, `null`/`undefined` ou contenu corrompu. Les
 * slugs inconnus sont ignorés, les doublons dédupliqués, et `name` est
 * toujours poussé en queue pour garantir un ordre total (deux équipes à
 * égalité stricte doivent rester classées de façon déterministe).
 */
export function parseCupTieBreakRules(
  raw: unknown,
): readonly CupTieBreakSlug[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return DEFAULT_CUP_TIE_BREAK_RULES;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_CUP_TIE_BREAK_RULES;
    }
  }
  if (!Array.isArray(parsed)) return DEFAULT_CUP_TIE_BREAK_RULES;

  const valid: CupTieBreakSlug[] = [];
  for (const item of parsed) {
    if (isSlug(item) && !valid.includes(item)) valid.push(item);
  }
  if (valid.length === 0) return DEFAULT_CUP_TIE_BREAK_RULES;
  if (!valid.includes("name")) valid.push("name");
  return valid;
}

/**
 * Normalise une liste saisie (route d'édition) avant persistance :
 * garde l'ordre, retire l'inconnu et les doublons. Retourne `null` quand
 * il ne reste rien d'exploitable — la colonne repart alors à `null` et le
 * classement retombe sur l'ordre par défaut.
 */
export function normalizeCupTieBreakRules(
  input: readonly string[] | null | undefined,
): CupTieBreakSlug[] | null {
  if (!input) return null;
  const valid: CupTieBreakSlug[] = [];
  for (const item of input) {
    if (isSlug(item) && !valid.includes(item)) valid.push(item);
  }
  if (valid.length === 0) return null;
  if (!valid.includes("name")) valid.push("name");
  return valid;
}

function compareBySlug(
  a: CupStandingRowForOrder,
  b: CupStandingRowForOrder,
  slug: CupTieBreakSlug,
): number {
  switch (slug) {
    case "points":
      return b.totalPoints - a.totalPoints;
    case "result_points":
      return b.resultPoints - a.resultPoints;
    case "action_points":
      return b.actionPoints - a.actionPoints;
    case "wins":
      return b.wins - a.wins;
    case "td_diff":
      return b.touchdownDiff - a.touchdownDiff;
    case "td_for":
      return b.touchdownsFor - a.touchdownsFor;
    case "td_against":
      // Moins de TD encaissés = mieux classé.
      return a.touchdownsAgainst - b.touchdownsAgainst;
    case "cas_diff":
      return (
        b.totalCasualtiesFor -
        b.totalCasualtiesAgainst -
        (a.totalCasualtiesFor - a.totalCasualtiesAgainst)
      );
    case "cas_for":
      return b.totalCasualtiesFor - a.totalCasualtiesFor;
    case "cas_against":
      // Moins de sorties subies = mieux classé.
      return a.totalCasualtiesAgainst - b.totalCasualtiesAgainst;
    case "passes":
      return b.passes - a.passes;
    case "played":
      // Plus de matchs joués = mieux classé (une équipe en retard ne
      // double pas celle qui a fait le travail à points égaux).
      return b.matchesPlayed - a.matchesPlayed;
    case "name":
      return a.teamName.localeCompare(b.teamName);
  }
}

/**
 * Comparateur `Array.prototype.sort` pour un classement de coupe.
 * Pur : testable sans Prisma.
 */
export function makeCupStandingsComparator(
  rules: readonly CupTieBreakSlug[],
): (a: CupStandingRowForOrder, b: CupStandingRowForOrder) => number {
  return (a, b) => {
    for (const slug of rules) {
      const cmp = compareBySlug(a, b, slug);
      if (cmp !== 0) return cmp;
    }
    return 0;
  };
}
