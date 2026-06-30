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
 * FR18 — scope PAR-SAISON quand des events de feuille de match (Lot G)
 * existent pour la saison (`scope: 'season'`), sinon repli sur les compteurs
 * career (`scope: 'career'`, ex: saison sans feuille saisie / tests SQLite) :
 *   * topScorers/Bashers/Passers/Interceptors : agreges des events de saison.
 *   * topKillers/Aggressors/TeamThrowers      : events de saison uniquement.
 *   * topMvps        : agregation des `motmPlayerIds` des feuilles de saison.
 *   * topFutureStars : PSP gagnes sur la saison (recalcul depuis les agregats
 *                      d'events + MVP, barème `SPP_VALUES` partage, override
 *                      "Bagarreurs Brutaux" par roster).
 *   * topPunchingBags: eliminations subies (events de saison) ; repli proxy
 *                      "blessures durables" career hors saison.
 *
 * Les joueurs sont filtres sur les teams inscrites a la saison.
 */

import { prisma } from "../prisma";
import {
  calculateAggregateSPP,
  rosterToModifier,
  type TeamSPPModifier,
} from "./spp-tracking";
import { parseStringArrayJson } from "./pro-player-career-stats";

export type PlayerStatCategory =
  | "topScorers"
  | "topBashers"
  | "topKillers"
  | "topAggressors"
  | "topTeamThrowers"
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
  /** "season" si dérivé des events de la saison, "career" en repli. */
  readonly scope: "career" | "season";
  readonly topScorers: PlayerStatRow[];
  readonly topBashers: PlayerStatRow[];
  /** FR18 — éliminations "mort" infligées (events de saison). */
  readonly topKillers: PlayerStatRow[];
  /** FR18 — agressions commises (events de saison). */
  readonly topAggressors: PlayerStatRow[];
  /** FR18 — lancers de coéquipier réussis (La Catapulte, events de saison). */
  readonly topTeamThrowers: PlayerStatRow[];
  readonly topPassers: PlayerStatRow[];
  readonly topInterceptors: PlayerStatRow[];
  /** FR18 — PSP gagnés sur la saison (events + MVP) ; repli career hors saison. */
  readonly topFutureStars: PlayerStatRow[];
  /** FR18 — titres de MVP de la saison (`motmPlayerIds`) ; repli career hors saison. */
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

  // FR18 — agrégation des events de feuille de match de la SAISON (kills,
  // agressions). Source précise par-saison (vs compteurs career). Tolérant :
  // si le modèle n'existe pas (SQLite de test), classements events vides.
  const killCounts = new Map<string, number>();
  const aggrCounts = new Map<string, number>();
  const throwCounts = new Map<string, number>();
  const sufferedCounts = new Map<string, number>();
  // Catégories aussi dérivables des events -> scope par-saison (vs career).
  const tdCounts = new Map<string, number>();
  const compCounts = new Map<string, number>();
  const intCounts = new Map<string, number>();
  const casCounts = new Map<string, number>();
  let hasEvents = false;
  // Types d'élimination subie comptés pour le "sac de frappe".
  const SUFFERED_KINDS = new Set([
    "casualty",
    "crowd_surge",
    "aggression",
    "other_elim",
  ]);
  try {
    const events = (await (
      prisma as unknown as {
        leagueMatchEvent: {
          findMany: (args: unknown) => Promise<
            Array<{
              kind: string;
              actorPlayerId: string | null;
              targetPlayerId: string | null;
              injurySeverity: string | null;
            }>
          >;
        };
      }
    ).leagueMatchEvent.findMany({
      // teamId non filtré ici : `topByCount` ne classe que les joueurs de
      // `players` (déjà restreints à la team quand `teamId` est fourni).
      where: {
        matchSheet: { pairing: { round: { seasonId: input.seasonId } } },
      },
      select: {
        kind: true,
        actorPlayerId: true,
        targetPlayerId: true,
        injurySeverity: true,
      },
    })) as Array<{
      kind: string;
      actorPlayerId: string | null;
      targetPlayerId: string | null;
      injurySeverity: string | null;
    }>;
    hasEvents = events.length > 0;
    const bump = (m: Map<string, number>, id: string) =>
      m.set(id, (m.get(id) ?? 0) + 1);
    for (const e of events) {
      if (e.actorPlayerId) {
        if (e.kind === "touchdown") bump(tdCounts, e.actorPlayerId);
        if (e.kind === "pass_complete") bump(compCounts, e.actorPlayerId);
        if (e.kind === "interception") bump(intCounts, e.actorPlayerId);
        if (e.kind === "casualty") bump(casCounts, e.actorPlayerId);
        if (e.kind === "casualty" && e.injurySeverity === "dead") {
          bump(killCounts, e.actorPlayerId);
        }
        if (e.kind === "aggression") bump(aggrCounts, e.actorPlayerId);
        if (e.kind === "team_throw") bump(throwCounts, e.actorPlayerId);
      }
      if (e.targetPlayerId && SUFFERED_KINDS.has(e.kind)) {
        bump(sufferedCounts, e.targetPlayerId);
      }
    }
  } catch {
    // Events indisponibles (tests SQLite) -> classements events vides.
  }

  // FR18 — MVP par SAISON : agrégation des `motmPlayerIds` des feuilles de
  // match de la saison (le commissaire désigne le/les MVP après validation).
  // Source par-saison fiable, vs le compteur career `totalMvpAwards`.
  const mvpCounts = new Map<string, number>();
  try {
    const sheets = (await (
      prisma as unknown as {
        leagueMatchSheet: {
          findMany: (args: unknown) => Promise<
            Array<{ motmPlayerIds: unknown }>
          >;
        };
      }
    ).leagueMatchSheet.findMany({
      where: { pairing: { round: { seasonId: input.seasonId } } },
      select: { motmPlayerIds: true },
    })) as Array<{ motmPlayerIds: unknown }>;
    for (const s of sheets) {
      for (const playerId of parseStringArrayJson(s.motmPlayerIds)) {
        mvpCounts.set(playerId, (mvpCounts.get(playerId) ?? 0) + 1);
      }
    }
  } catch {
    // Feuilles de match indisponibles (tests SQLite) -> repli career.
  }

  // FR18 — Future Star par SAISON : PSP gagnés sur la saison, recalculés
  // depuis les agrégats d'events (TD/cas/comp/int) + titres de MVP, avec
  // l'override "Bagarreurs Brutaux" du roster de chaque joueur. Source unique
  // de barème : `SPP_VALUES` (cf. spp-tracking). Repli career (`p.spp`) hors
  // saison. Tolérant : si `Roster.specialRules` est illisible, barème vanilla.
  const modifierByRoster = new Map<string, TeamSPPModifier>();
  try {
    const rosterSlugs = [...new Set(players.map((p) => p.team.roster))];
    const rosters = (await prisma.roster.findMany({
      where: { slug: { in: rosterSlugs } },
      select: { slug: true, specialRules: true },
    })) as Array<{ slug: string; specialRules: string | null }>;
    for (const r of rosters) {
      modifierByRoster.set(r.slug, rosterToModifier(r.specialRules ?? ""));
    }
  } catch {
    // specialRules indisponible -> barème vanilla pour tous (map vide).
  }
  const seasonSppByPlayer = new Map<string, number>();
  for (const p of players) {
    const earned = calculateAggregateSPP(
      {
        touchdowns: tdCounts.get(p.id) ?? 0,
        casualties: casCounts.get(p.id) ?? 0,
        completions: compCounts.get(p.id) ?? 0,
        interceptions: intCounts.get(p.id) ?? 0,
        mvps: mvpCounts.get(p.id) ?? 0,
      },
      modifierByRoster.get(p.team.roster),
    );
    if (earned > 0) seasonSppByPlayer.set(p.id, earned);
  }

  // Sac de frappe : éliminations subies (events de saison) si disponibles ;
  // sinon repli sur la proxy "blessures durables" (compteur career).
  const topPunchingBags =
    sufferedCounts.size > 0
      ? topByCount(players, sufferedCounts, topN)
      : topByMetric(players, (p) => p.nigglingInjuries, topN);

  // FR18 — scope par-saison quand des events existent (sinon repli career).
  // MVP = agrégation des `motmPlayerIds` de la saison ; Future Star = PSP
  // gagnés sur la saison (recalcul depuis agrégats + MVP). Repli career pour
  // les deux quand aucun event de saison n'est disponible.
  return {
    seasonId: input.seasonId,
    topN,
    scope: hasEvents ? "season" : "career",
    topScorers: hasEvents
      ? topByCount(players, tdCounts, topN)
      : topByMetric(players, (p) => p.totalTouchdowns, topN),
    topBashers: hasEvents
      ? topByCount(players, casCounts, topN)
      : topByMetric(players, (p) => p.totalCasualties, topN),
    topKillers: topByCount(players, killCounts, topN),
    topAggressors: topByCount(players, aggrCounts, topN),
    topTeamThrowers: topByCount(players, throwCounts, topN),
    topPassers: hasEvents
      ? topByCount(players, compCounts, topN)
      : topByMetric(players, (p) => p.totalCompletions, topN),
    topInterceptors: hasEvents
      ? topByCount(players, intCounts, topN)
      : topByMetric(players, (p) => p.totalInterceptions, topN),
    topFutureStars: hasEvents
      ? topByCount(players, seasonSppByPlayer, topN)
      : topByMetric(players, (p) => p.spp, topN),
    topMvps: hasEvents
      ? topByCount(players, mvpCounts, topN)
      : topByMetric(players, (p) => p.totalMvpAwards, topN),
    topPunchingBags,
  };
}

/**
 * Classe les joueurs par un compteur d'events (Map playerId -> n). Seuls les
 * joueurs présents dans `players` (équipes de la saison) sont classés ; ceux à
 * 0 sont exclus.
 */
function topByCount(
  players: ReadonlyArray<PlayerSelected>,
  counts: ReadonlyMap<string, number>,
  topN: number,
): PlayerStatRow[] {
  return [...players]
    .map((p) => ({ p, v: counts.get(p.id) ?? 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, topN)
    .map((x, idx) => toRow(x.p, x.v, idx + 1));
}

function emptyCatalogue(seasonId: string, topN: number): PlayerStatsCatalogue {
  return {
    seasonId,
    topN,
    scope: "career",
    topScorers: [],
    topBashers: [],
    topKillers: [],
    topAggressors: [],
    topTeamThrowers: [],
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
    key: "topKillers",
    label: "Meilleur killer",
    description: "Plus de blessures Mort infligees (saison).",
  },
  {
    key: "topAggressors",
    label: "Meilleur agresseur",
    description: "Plus d'agressions commises (saison).",
  },
  {
    key: "topTeamThrowers",
    label: "Meilleur lanceur de coéquipier",
    description: "Plus de lancers de coéquipier (La Catapulte, saison).",
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
    description:
      "Plus d'éliminations subies (events de saison ; repli sur blessures durables).",
  },
];
