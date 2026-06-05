/**
 * Lot J — Statistiques top-N joueurs par ligue / saison.
 *
 * V1 — base sur les totaux career stockes sur `TeamPlayer` :
 *   * topScorers       : totalTouchdowns DESC
 *   * topBashers       : totalCasualties DESC
 *   * topPassers       : totalCompletions DESC
 *   * topInterceptors  : totalInterceptions DESC
 *   * topFutureStars   : spp DESC (futur talent)
 *   * topMvps          : totalMvpAwards DESC
 *   * topPunchingBags  : matchesPlayed DESC + (na/ag/st/pa/av) reductions
 *                        (heuristique — non-precise mais lit les LASTING
 *                        INJURIES comme proxy du "sac de frappe").
 *
 * Limitation V1 — les compteurs sont **career** : un joueur qui a
 * joue en dehors de la saison aura un total gonfle. Pour une V2
 * precise par-saison, il faudra agreger depuis les events de la
 * feuille de match (Lot G) ou stocker un snapshot start-of-season.
 *
 * Pour minimiser cette limite : on filtre les joueurs sur les
 * teams inscrites a la saison ET on indique clairement le scope
 * "carriere" dans la reponse (le flag `scope: 'career'`).
 *
 * Les categories manquantes (killer / catapulte / agresseur / sac
 * de frappe stricto sensu) seront ajoutees quand la match-sheet v2
 * (Lot G) tracera les events detailles.
 */

import { prisma } from "../prisma";

export type PlayerStatCategory =
  | "topScorers"
  | "topBashers"
  | "topPassers"
  | "topInterceptors"
  | "topFutureStars"
  | "topMvps"
  | "topPunchingBags";

export interface PlayerStatRow {
  readonly rank: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly position: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly teamRoster: string;
  readonly ownerId: string;
  readonly ownerCoachName: string | null;
  readonly value: number;
  /** Stats secondaires utiles pour breakage de l'egalite cote UI. */
  readonly secondary: {
    readonly matchesPlayed: number;
    readonly spp: number;
  };
}

export interface PlayerStatsCatalogue {
  readonly seasonId: string;
  readonly topN: number;
  readonly scope: "career";
  readonly topScorers: PlayerStatRow[];
  readonly topBashers: PlayerStatRow[];
  readonly topPassers: PlayerStatRow[];
  readonly topInterceptors: PlayerStatRow[];
  readonly topFutureStars: PlayerStatRow[];
  readonly topMvps: PlayerStatRow[];
  readonly topPunchingBags: PlayerStatRow[];
}

interface PlayerSelected {
  id: string;
  name: string;
  position: string;
  spp: number;
  totalTouchdowns: number;
  totalCasualties: number;
  totalCompletions: number;
  totalInterceptions: number;
  totalMvpAwards: number;
  matchesPlayed: number;
  nigglingInjuries: number;
  team: {
    id: string;
    name: string;
    roster: string;
    owner: { id: string; coachName: string | null };
  };
}

const DEFAULT_TOP_N = 5;
const MAX_TOP_N = 50;

function clampTopN(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_TOP_N;
  return Math.min(MAX_TOP_N, Math.max(1, Math.floor(raw)));
}

function toRow(p: PlayerSelected, value: number, rank: number): PlayerStatRow {
  return {
    rank,
    playerId: p.id,
    playerName: p.name,
    position: p.position,
    teamId: p.team.id,
    teamName: p.team.name,
    teamRoster: p.team.roster,
    ownerId: p.team.owner.id,
    ownerCoachName: p.team.owner.coachName ?? null,
    value,
    secondary: {
      matchesPlayed: p.matchesPlayed,
      spp: p.spp,
    },
  };
}

function topByMetric(
  players: ReadonlyArray<PlayerSelected>,
  metric: (p: PlayerSelected) => number,
  topN: number,
  /**
   * Filtre prealable (exclure les joueurs ayant 0 sur la metrique
   * pour eviter de saturer le classement avec des newcomers).
   */
  includeZero: boolean = false,
): PlayerStatRow[] {
  const sorted = [...players]
    .filter((p) => includeZero || metric(p) > 0)
    .sort((a, b) => metric(b) - metric(a))
    .slice(0, topN);
  return sorted.map((p, idx) => toRow(p, metric(p), idx + 1));
}

/**
 * Calcule les classements top-N pour la saison. Filtre les joueurs
 * sur les teams `LeagueParticipant` (status='active') de la saison.
 * Si `teamId` est fourni, restreint encore aux joueurs de cette
 * team (utilise par la decline "top 3 par equipe").
 */
export async function computeLeaderboards(input: {
  seasonId: string;
  topN?: number;
  teamId?: string;
}): Promise<PlayerStatsCatalogue> {
  const topN = clampTopN(input.topN);

  // Cap les teams a la saison via groupBy/join. Une seule query Prisma.
  const participants = (await prisma.leagueParticipant.findMany({
    where: {
      seasonId: input.seasonId,
      status: "active",
      ...(input.teamId ? { teamId: input.teamId } : {}),
    },
    select: { teamId: true },
  })) as Array<{ teamId: string }>;
  const teamIds = participants.map((p) => p.teamId);
  if (teamIds.length === 0) {
    return emptyCatalogue(input.seasonId, topN);
  }

  const players = (await prisma.teamPlayer.findMany({
    where: { teamId: { in: teamIds }, dead: false },
    select: {
      id: true,
      name: true,
      position: true,
      spp: true,
      totalTouchdowns: true,
      totalCasualties: true,
      totalCompletions: true,
      totalInterceptions: true,
      totalMvpAwards: true,
      matchesPlayed: true,
      nigglingInjuries: true,
      team: {
        select: {
          id: true,
          name: true,
          roster: true,
          owner: { select: { id: true, coachName: true } },
        },
      },
    },
  })) as PlayerSelected[];

  return {
    seasonId: input.seasonId,
    topN,
    scope: "career",
    topScorers: topByMetric(players, (p) => p.totalTouchdowns, topN),
    topBashers: topByMetric(players, (p) => p.totalCasualties, topN),
    topPassers: topByMetric(players, (p) => p.totalCompletions, topN),
    topInterceptors: topByMetric(players, (p) => p.totalInterceptions, topN),
    topFutureStars: topByMetric(players, (p) => p.spp, topN),
    topMvps: topByMetric(players, (p) => p.totalMvpAwards, topN),
    // Sac de frappe : heuristique sur les blessures permanentes
    // accumulees (proxy faute d'event "subi une elim" precis).
    topPunchingBags: topByMetric(players, (p) => p.nigglingInjuries, topN),
  };
}

function emptyCatalogue(seasonId: string, topN: number): PlayerStatsCatalogue {
  return {
    seasonId,
    topN,
    scope: "career",
    topScorers: [],
    topBashers: [],
    topPassers: [],
    topInterceptors: [],
    topFutureStars: [],
    topMvps: [],
    topPunchingBags: [],
  };
}

/**
 * Decline les classements par equipe : retourne, pour chaque
 * `participant.teamId`, le top-3 (par defaut) des joueurs dans
 * chaque categorie.
 */
export async function computeLeaderboardsByTeam(input: {
  seasonId: string;
  topN?: number;
}): Promise<Array<{ teamId: string; teamName: string; catalogue: PlayerStatsCatalogue }>> {
  const topN = clampTopN(input.topN ?? 3);
  const participants = (await prisma.leagueParticipant.findMany({
    where: { seasonId: input.seasonId, status: "active" },
    include: {
      team: { select: { id: true, name: true } },
    },
  })) as Array<{ team: { id: string; name: string } }>;

  // Une query par team — pas optimal pour 50 teams, mais
  // suffisant pour la majorite des ligues (< 16 teams). Pour une
  // grosse ligue, refactor en `groupBy` cote DB.
  const out: Array<{
    teamId: string;
    teamName: string;
    catalogue: PlayerStatsCatalogue;
  }> = [];
  for (const p of participants) {
    const catalogue = await computeLeaderboards({
      seasonId: input.seasonId,
      topN,
      teamId: p.team.id,
    });
    out.push({ teamId: p.team.id, teamName: p.team.name, catalogue });
  }
  return out;
}

/** Liste des cles de catalogue exposees (pour les filtres UI). */
export const LEADERBOARD_CATEGORIES: ReadonlyArray<{
  key: PlayerStatCategory;
  label: string;
  description: string;
}> = [
  {
    key: "topScorers",
    label: "Meilleur marqueur",
    description: "Plus de touchdowns inscrits.",
  },
  {
    key: "topBashers",
    label: "Meilleur castagneur",
    description: "Plus de sorties infligees (sur blocage et autres).",
  },
  {
    key: "topPassers",
    label: "Meilleur passeur",
    description: "Plus de passes completes.",
  },
  {
    key: "topInterceptors",
    label: "Meilleur intercepteur",
    description: "Plus d'interceptions reussies.",
  },
  {
    key: "topFutureStars",
    label: "Future star",
    description: "Plus de SPP accumules.",
  },
  {
    key: "topMvps",
    label: "Joueur du match",
    description: "Plus de titres MVP.",
  },
  {
    key: "topPunchingBags",
    label: "Sac de frappe",
    description: "Plus de blessures durables subies.",
  },
];
