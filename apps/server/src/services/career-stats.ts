/**
 * Career stats aggregation for N.6 — Historique de matchs avec stats de carriere.
 *
 * Pure functions that take pre-fetched match/player data and aggregate them.
 * The route layer is responsible for loading Prisma entities and mapping them
 * to the shapes declared below.
 */

export type TeamSide = "A" | "B";

export interface TeamMatchRecord {
  matchId: string;
  teamSide: TeamSide;
  scoreA: number;
  scoreB: number;
  casualtiesInflicted: number;
  casualtiesSuffered: number;
  completions: number;
  interceptions: number;
  createdAt: Date;
  endedAt: Date | null;
  opponentCoachName: string | null;
  opponentTeamName: string | null;
  opponentRoster: string | null;
}

export interface TeamCareerRecord {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  casualtiesInflicted: number;
  casualtiesSuffered: number;
  completions: number;
  interceptions: number;
  winRate: number;
}

export function aggregateTeamCareer(
  records: ReadonlyArray<TeamMatchRecord>,
): TeamCareerRecord {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let touchdownsFor = 0;
  let touchdownsAgainst = 0;
  let casualtiesInflicted = 0;
  let casualtiesSuffered = 0;
  let completions = 0;
  let interceptions = 0;

  for (const record of records) {
    const myScore = record.teamSide === "A" ? record.scoreA : record.scoreB;
    const oppScore = record.teamSide === "A" ? record.scoreB : record.scoreA;

    touchdownsFor += myScore;
    touchdownsAgainst += oppScore;
    casualtiesInflicted += record.casualtiesInflicted;
    casualtiesSuffered += record.casualtiesSuffered;
    completions += record.completions;
    interceptions += record.interceptions;

    if (myScore > oppScore) wins += 1;
    else if (myScore < oppScore) losses += 1;
    else draws += 1;
  }

  const matchesPlayed = records.length;
  const winRate =
    matchesPlayed === 0 ? 0 : (wins + draws * 0.5) / matchesPlayed;

  return {
    matchesPlayed,
    wins,
    draws,
    losses,
    touchdownsFor,
    touchdownsAgainst,
    casualtiesInflicted,
    casualtiesSuffered,
    completions,
    interceptions,
    winRate,
  };
}

export interface TeamPlayerForStats {
  id: string;
  name: string;
  number: number;
  position: string;
  spp: number;
  matchesPlayed: number;
  totalTouchdowns: number;
  totalCasualties: number;
  totalCompletions: number;
  totalInterceptions: number;
  totalMvpAwards: number;
  nigglingInjuries: number;
  advancements: string;
  dead: boolean;
}

export interface PlayerCareerStats {
  id: string;
  name: string;
  number: number;
  position: string;
  spp: number;
  matchesPlayed: number;
  totalTouchdowns: number;
  totalCasualties: number;
  totalCompletions: number;
  totalInterceptions: number;
  totalMvpAwards: number;
  nigglingInjuries: number;
  advancementsCount: number;
  dead: boolean;
}

function parseAdvancementsCount(raw: string): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function toPlayerCareerStats(
  player: TeamPlayerForStats,
): PlayerCareerStats {
  return {
    id: player.id,
    name: player.name,
    number: player.number,
    position: player.position,
    spp: player.spp,
    matchesPlayed: player.matchesPlayed,
    totalTouchdowns: player.totalTouchdowns,
    totalCasualties: player.totalCasualties,
    totalCompletions: player.totalCompletions,
    totalInterceptions: player.totalInterceptions,
    totalMvpAwards: player.totalMvpAwards,
    nigglingInjuries: player.nigglingInjuries,
    advancementsCount: parseAdvancementsCount(player.advancements),
    dead: player.dead,
  };
}

/**
 * Extract a per-team match record from a game state snapshot + selection.
 *
 * `gameState.matchStats` is keyed by player engine id (e.g. "A3") and carries
 * touchdowns / casualties / completions / interceptions per player.
 */
export interface GameStateSnapshot {
  score?: { teamA?: number; teamB?: number };
  matchStats?: Record<
    string,
    {
      touchdowns?: number;
      casualties?: number;
      completions?: number;
      interceptions?: number;
    }
  >;
  players?: Array<{ id: string; team?: string }>;
}

export interface MatchInfoForRecord {
  matchId: string;
  createdAt: Date;
  endedAt: Date | null;
  opponentCoachName: string | null;
  opponentTeamName: string | null;
  opponentRoster: string | null;
}

export function buildTeamMatchRecord(
  teamSide: TeamSide,
  gameState: GameStateSnapshot | null | undefined,
  info: MatchInfoForRecord,
): TeamMatchRecord {
  const scoreA = Number(gameState?.score?.teamA ?? 0) || 0;
  const scoreB = Number(gameState?.score?.teamB ?? 0) || 0;

  let casualtiesInflicted = 0;
  let casualtiesSuffered = 0;
  let completions = 0;
  let interceptions = 0;

  const players = gameState?.players ?? [];
  const matchStats = gameState?.matchStats ?? {};

  for (const player of players) {
    const stats = matchStats[player.id];
    if (!stats) continue;
    const isMine = player.team === teamSide;
    const td = stats.touchdowns ?? 0;
    const cas = stats.casualties ?? 0;
    const cmp = stats.completions ?? 0;
    const intcp = stats.interceptions ?? 0;
    if (isMine) {
      casualtiesInflicted += cas;
      completions += cmp;
      interceptions += intcp;
      // touchdowns are already reflected in scoreA/scoreB; skip double counting
      void td;
    } else {
      casualtiesSuffered += cas;
    }
  }

  return {
    matchId: info.matchId,
    teamSide,
    scoreA,
    scoreB,
    casualtiesInflicted,
    casualtiesSuffered,
    completions,
    interceptions,
    createdAt: info.createdAt,
    endedAt: info.endedAt,
    opponentCoachName: info.opponentCoachName,
    opponentTeamName: info.opponentTeamName,
    opponentRoster: info.opponentRoster,
  };
}
