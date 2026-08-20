/**
 * Classements PAR EQUIPE d'une saison de ligue (totaux d'equipe).
 *
 * Retour utilisateur : « les statistiques par equipe ne sont pas le
 * detail des statistiques par equipe mais la declinaison des
 * statistiques pour les equipes (les totaux). Exemple : les 5
 * meilleures equipes marqueuses de TD. »
 *
 * On ne re-agrege rien : `computeSeasonStandings` fournit deja tous les
 * totaux par equipe (TD+/TD-, sorties, passes, interceptions,
 * agressions, sorties public — cf. `league-standings-stats`). Ce module
 * se contente d'en tirer des top-N par categorie, comme les awards de
 * fin de saison (`league-scoring.pickTop`) mais en podium de N entrees.
 *
 * `buildTeamLeaderboards` est PUR (testable sans DB) ;
 * `computeTeamLeaderboards` fait le seul I/O (standings).
 */

import {
  computeSeasonStandings,
  type StandingRow,
} from "./league";

export interface TeamStatRow {
  readonly rank: number;
  readonly teamId: string;
  readonly teamName: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly ownerId: string;
  readonly coachName: string | null;
  /** Valeur de la categorie (TD marques, sorties infligees, ...). */
  readonly value: number;
  /** Matchs joues (contexte affiche a cote de la valeur). */
  readonly played: number;
}

export type TeamStatCategory =
  | "topScorers"
  | "bestDefenses"
  | "topBashers"
  | "topMartyrs"
  | "topPassers"
  | "topInterceptors"
  | "topAggressors"
  | "topCrowdSurges";

export interface TeamStatsCatalogue {
  readonly seasonId: string;
  readonly topN: number;
  readonly topScorers: readonly TeamStatRow[];
  readonly bestDefenses: readonly TeamStatRow[];
  readonly topBashers: readonly TeamStatRow[];
  readonly topMartyrs: readonly TeamStatRow[];
  readonly topPassers: readonly TeamStatRow[];
  readonly topInterceptors: readonly TeamStatRow[];
  readonly topAggressors: readonly TeamStatRow[];
  readonly topCrowdSurges: readonly TeamStatRow[];
}

/** Libelles/descriptions FR des categories (meme esprit que Lot J). */
export const TEAM_LEADERBOARD_CATEGORIES: ReadonlyArray<{
  key: TeamStatCategory;
  label: string;
  description: string;
}> = [
  {
    key: "topScorers",
    label: "Marqueurs de TD",
    description: "Le plus de touchdowns marqués.",
  },
  {
    key: "bestDefenses",
    label: "Meilleure défense",
    description: "Le moins de touchdowns encaissés (équipes ayant joué).",
  },
  {
    key: "topBashers",
    label: "Meilleure castagne",
    description: "Le plus d'éliminations infligées.",
  },
  {
    key: "topMartyrs",
    label: "Infirmerie pleine",
    description: "Le plus d'éliminations subies.",
  },
  {
    key: "topPassers",
    label: "Jeu de passe",
    description: "Le plus de passes complétées.",
  },
  {
    key: "topInterceptors",
    label: "Interceptions",
    description: "Le plus d'interceptions réussies.",
  },
  {
    key: "topAggressors",
    label: "Agressions",
    description: "Le plus d'agressions commises.",
  },
  {
    key: "topCrowdSurges",
    label: "Sorties public",
    description: "Le plus d'adversaires poussés dans le public.",
  },
];

function toRow(s: StandingRow, rank: number, value: number): TeamStatRow {
  return {
    rank,
    teamId: s.teamId,
    teamName: s.teamName,
    roster: s.roster,
    logoUrl: s.logoUrl ?? null,
    ownerId: s.ownerId,
    coachName: s.coachName ?? null,
    value,
    played: s.played,
  };
}

/**
 * Top-N descendant : filtre les valeurs a zero (meme convention que les
 * classements joueurs — un podium de zeros n'a pas d'interet), departage
 * par nom d'equipe pour rester deterministe.
 */
function topTeamsBy(
  rows: readonly StandingRow[],
  pick: (row: StandingRow) => number,
  topN: number,
): TeamStatRow[] {
  return [...rows]
    .map((s) => ({ s, value: pick(s) }))
    .filter((e) => e.value > 0)
    .sort(
      (a, b) => b.value - a.value || a.s.teamName.localeCompare(b.s.teamName),
    )
    .slice(0, topN)
    .map((e, i) => toRow(e.s, i + 1, e.value));
}

/**
 * Top-N ascendant (meilleure defense) : 0 encaisse est un score
 * legitime, mais une equipe qui n'a pas joue ne peut pas figurer.
 */
function bottomTeamsBy(
  rows: readonly StandingRow[],
  pick: (row: StandingRow) => number,
  topN: number,
): TeamStatRow[] {
  return [...rows]
    .filter((s) => s.played > 0)
    .map((s) => ({ s, value: pick(s) }))
    .sort(
      (a, b) => a.value - b.value || a.s.teamName.localeCompare(b.s.teamName),
    )
    .slice(0, topN)
    .map((e, i) => toRow(e.s, i + 1, e.value));
}

/** PUR — derive le catalogue de tops d'equipes depuis le classement. */
export function buildTeamLeaderboards(
  standings: readonly StandingRow[],
  args: { seasonId: string; topN: number },
): TeamStatsCatalogue {
  // Les equipes retirees ne concourent pas aux tops.
  const rows = standings.filter((s) => s.status !== "withdrawn");
  const topN = args.topN;
  return {
    seasonId: args.seasonId,
    topN,
    topScorers: topTeamsBy(rows, (s) => s.touchdownsFor, topN),
    bestDefenses: bottomTeamsBy(rows, (s) => s.touchdownsAgainst, topN),
    topBashers: topTeamsBy(rows, (s) => s.casualtiesFor, topN),
    topMartyrs: topTeamsBy(rows, (s) => s.casualtiesAgainst, topN),
    topPassers: topTeamsBy(rows, (s) => s.passes ?? 0, topN),
    topInterceptors: topTeamsBy(rows, (s) => s.interceptions ?? 0, topN),
    topAggressors: topTeamsBy(rows, (s) => s.aggressions ?? 0, topN),
    topCrowdSurges: topTeamsBy(rows, (s) => s.crowdSurges ?? 0, topN),
  };
}

export const DEFAULT_TEAM_LEADERBOARD_TOP_N = 5;

/** Catalogue des tops d'equipes d'une saison (1 seul I/O : standings). */
export async function computeTeamLeaderboards(args: {
  seasonId: string;
  topN?: number;
}): Promise<TeamStatsCatalogue> {
  const topN = clampTopN(args.topN);
  const standings = await computeSeasonStandings(args.seasonId);
  return buildTeamLeaderboards(standings, { seasonId: args.seasonId, topN });
}

/** Borne le top-N demande (meme fenetre que les classements joueurs). */
export function clampTopN(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_TEAM_LEADERBOARD_TOP_N;
  }
  return Math.max(1, Math.min(50, Math.floor(raw)));
}
