/**
 * Statistiques de matchs affichées sur la fiche d'équipe.
 *
 * Le serveur sert `matchStats` (ligue + coupe + amical, cf.
 * `services/team-match-stats`). Auparavant la fiche lisait `localMatchStats`,
 * qui ignore les rencontres de LIGUE : une équipe ayant joué une saison
 * entière y affichait « 0 match ». Ce module pur en tire la vue, testable
 * sans DOM, et retombe sur `localMatchStats` face à une API antérieure au
 * champ (sans détail par compétition).
 */

export interface TeamRecordCounts {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly touchdownsFor: number;
  readonly touchdownsAgainst: number;
}

export interface TeamMatchStatsView extends TeamRecordCounts {
  readonly touchdownDiff: number;
  /** Matchs joués par compétition ; `null` quand l'API ne le sert pas. */
  readonly breakdown: {
    readonly league: number;
    readonly cup: number;
    readonly friendly: number;
  } | null;
}

interface TeamDetailPayload {
  readonly matchStats?: unknown;
  readonly localMatchStats?: unknown;
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === "object" && value !== null;
}

function num(bag: Bag | undefined, key: string): number {
  const value = bag?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function view(
  counts: TeamRecordCounts,
  breakdown: TeamMatchStatsView["breakdown"],
): TeamMatchStatsView {
  return {
    ...counts,
    touchdownDiff: counts.touchdownsFor - counts.touchdownsAgainst,
    breakdown,
  };
}

function playedOf(bySource: Bag | undefined, key: string): number {
  const source = bySource?.[key];
  return isBag(source) ? num(source, "played") : 0;
}

export function resolveTeamMatchStats(
  payload: TeamDetailPayload | null | undefined,
): TeamMatchStatsView | null {
  const all = payload?.matchStats;
  if (isBag(all)) {
    const bySource = isBag(all.bySource) ? all.bySource : undefined;
    return view(
      {
        played: num(all, "played"),
        wins: num(all, "wins"),
        draws: num(all, "draws"),
        losses: num(all, "losses"),
        touchdownsFor: num(all, "touchdownsFor"),
        touchdownsAgainst: num(all, "touchdownsAgainst"),
      },
      bySource
        ? {
            league: playedOf(bySource, "league"),
            cup: playedOf(bySource, "cup"),
            friendly: playedOf(bySource, "friendly"),
          }
        : null,
    );
  }

  // API antérieure à `matchStats` : seuls les LocalMatch complétés.
  const local = payload?.localMatchStats;
  if (isBag(local)) {
    return view(
      {
        played: num(local, "completed"),
        wins: num(local, "wins"),
        draws: num(local, "draws"),
        losses: num(local, "losses"),
        touchdownsFor: num(local, "touchdownsFor"),
        touchdownsAgainst: num(local, "touchdownsAgainst"),
      },
      null,
    );
  }
  return null;
}

/** « +3 », « 0 », « -2 » : le signe du différentiel est toujours explicite. */
export function formatTouchdownDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : String(diff);
}
