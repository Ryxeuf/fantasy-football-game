/**
 * Statistiques d'une coupe à la demande (`GET /cup/:id/leaderboards`) : les
 * classements individuels au top N choisi, et les tops PAR ÉQUIPE — le
 * pendant de la page de statistiques d'une saison de ligue.
 *
 * Tout est DÉRIVÉ des matchs complétés de la coupe (feuilles validées
 * matérialisées) avec les règles existantes : `computeCupStandings` pour les
 * totaux d'équipe, `computeCupPlayerLeaderboards` pour les joueurs. Rien de
 * neuf n'est compté ici, seulement trié et borné. Pas de « future star » ni
 * de MVP : ni PSP ni Joueur du Match en coupe.
 */

import { prisma } from "../prisma";
import {
  computeCupStandings,
  type CupTeamStats,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "../cupScoring";
import {
  CUP_LEADERBOARD_CATEGORIES,
  computeCupPlayerLeaderboards,
  type CupMatchForPlayerStats,
  type CupPlayerLeaderboards,
} from "./cup-player-stats";
import { cupByesByTeamId, listCupRounds } from "./cup-rounds";

export const CUP_LEADERBOARDS_DEFAULT_TOP_N = 10;
export const CUP_LEADERBOARDS_MAX_TOP_N = 50;

export type CupTeamStatCategory =
  | "topScorers"
  | "bestDefenses"
  | "topBashers"
  | "topMartyrs"
  | "topPassers"
  | "topAggressors";

export const CUP_TEAM_LEADERBOARD_CATEGORIES: ReadonlyArray<{
  key: CupTeamStatCategory;
  label: string;
  description: string;
}> = [
  { key: "topScorers", label: "Marqueurs de TD", description: "Le plus de touchdowns marqués." },
  {
    key: "bestDefenses",
    label: "Meilleure défense",
    description: "Le moins de touchdowns encaissés (équipes ayant joué).",
  },
  { key: "topBashers", label: "Meilleure castagne", description: "Le plus de sorties infligées." },
  { key: "topMartyrs", label: "Infirmerie pleine", description: "Le plus de sorties subies." },
  { key: "topPassers", label: "Jeu de passe", description: "Le plus de passes réussies." },
  {
    key: "topAggressors",
    label: "Agressions",
    description: "Le plus de sorties sur agression.",
  },
];

export interface CupTeamLeaderboardRow {
  readonly rank: number;
  readonly teamId: string;
  readonly teamName: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly matchesPlayed: number;
  readonly value: number;
}

export type CupTeamLeaderboards = Record<CupTeamStatCategory, CupTeamLeaderboardRow[]>;

/** Borne le top N demandé (1 à 50, défaut 10). */
export function clampCupTopN(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return CUP_LEADERBOARDS_DEFAULT_TOP_N;
  return Math.min(CUP_LEADERBOARDS_MAX_TOP_N, Math.max(1, Math.trunc(n)));
}

function rankRows(
  stats: readonly CupTeamStats[],
  pick: (s: CupTeamStats) => number,
  options: { ascending?: boolean; playedOnly?: boolean },
  topN: number,
): CupTeamLeaderboardRow[] {
  const rows = stats
    .filter((s) => (options.playedOnly ? s.matchesPlayed > 0 : pick(s) > 0))
    .map((s) => ({ s, value: pick(s) }))
    .sort(
      (a, b) =>
        (options.ascending ? a.value - b.value : b.value - a.value) ||
        a.s.teamName.localeCompare(b.s.teamName, "fr"),
    );
  const out: CupTeamLeaderboardRow[] = [];
  rows.forEach(({ s, value }, index) => {
    const previous = out[index - 1];
    out.push({
      // Ex æquo : même rang que la ligne précédente.
      rank: previous && previous.value === value ? previous.rank : index + 1,
      teamId: s.teamId,
      teamName: s.teamName,
      roster: s.roster,
      logoUrl: s.logoUrl ?? null,
      matchesPlayed: s.matchesPlayed,
      value,
    });
  });
  return out.slice(0, topN);
}

/** Tops par équipe sur les totaux du classement (PUR). */
export function cupTeamLeaderboards(
  stats: readonly CupTeamStats[],
  topN: number,
): CupTeamLeaderboards {
  return {
    topScorers: rankRows(stats, (s) => s.touchdownsFor, {}, topN),
    bestDefenses: rankRows(stats, (s) => s.touchdownsAgainst, { ascending: true, playedOnly: true }, topN),
    topBashers: rankRows(stats, (s) => s.totalCasualtiesFor, {}, topN),
    topMartyrs: rankRows(stats, (s) => s.totalCasualtiesAgainst, {}, topN),
    topPassers: rankRows(stats, (s) => s.passes, {}, topN),
    topAggressors: rankRows(stats, (s) => s.foulCasualties, {}, topN),
  };
}

export interface CupLeaderboardsView {
  readonly cup: { readonly id: string; readonly name: string };
  readonly topN: number;
  readonly players: CupPlayerLeaderboards;
  readonly playerCategories: typeof CUP_LEADERBOARD_CATEGORIES;
  readonly teams: CupTeamLeaderboards;
  readonly teamCategories: typeof CUP_TEAM_LEADERBOARD_CATEGORIES;
}

export class CupLeaderboardsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CupLeaderboardsError";
  }
}

const TEAM_SELECT = { select: { id: true, name: true, roster: true, logoUrl: true } } as const;

/** Charge la coupe et ses matchs complétés, puis classe (lecture seule). */
export async function loadCupLeaderboards(input: {
  readonly cupId: string;
  readonly topN: number;
}): Promise<CupLeaderboardsView> {
  const cup = (await prisma.cup.findUnique({
    where: { id: input.cupId },
    include: {
      participants: { include: { team: TEAM_SELECT } },
      localMatches: {
        where: { status: "completed" },
        include: { teamA: TEAM_SELECT, teamB: TEAM_SELECT, actions: true },
      },
    },
  })) as unknown as
    | (CupWithParticipantsAndScoring & {
        localMatches: Array<LocalMatchWithRelations & CupMatchForPlayerStats>;
      })
    | null;
  if (!cup) throw new CupLeaderboardsError("Coupe introuvable");

  const rounds = await listCupRounds(cup.id);
  const standings = computeCupStandings(cup, cup.localMatches, {
    byesByTeamId: cupByesByTeamId(rounds),
  });
  return {
    cup: { id: cup.id, name: cup.name },
    topN: input.topN,
    players: computeCupPlayerLeaderboards(cup.localMatches, input.topN),
    playerCategories: CUP_LEADERBOARD_CATEGORIES,
    teams: cupTeamLeaderboards(standings.teamStats, input.topN),
    teamCategories: CUP_TEAM_LEADERBOARD_CATEGORIES,
  };
}
