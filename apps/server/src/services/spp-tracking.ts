import type { PrismaClient } from "@prisma/client";

/**
 * SPP (Star Player Points) values per action, following BB3 Season 2/3 rules:
 * - Touchdown: 3 SPP
 * - Casualty: 2 SPP
 * - Completion (pass): 1 SPP
 * - Interception: 1 SPP
 * - MVP: 4 SPP
 */
const SPP_VALUES = {
  touchdown: 3,
  casualty: 2,
  completion: 1,
  interception: 1,
  mvp: 4,
} as const;

export interface PlayerMatchStats {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvp: boolean;
}

export interface GameStateForSPP {
  matchStats: Record<string, PlayerMatchStats>;
  players: Array<{
    id: string;
    team: string;
    number: number;
  }>;
}

/**
 * Calculate SPP earned by a player from their match stats.
 */
export function calculatePlayerSPP(stats: PlayerMatchStats): number {
  return (
    stats.touchdowns * SPP_VALUES.touchdown +
    stats.casualties * SPP_VALUES.casualty +
    stats.completions * SPP_VALUES.completion +
    stats.interceptions * SPP_VALUES.interception +
    (stats.mvp ? SPP_VALUES.mvp : 0)
  );
}

/**
 * Persist SPP earned during a match to the database TeamPlayer records.
 *
 * Maps game engine player IDs (e.g. "A7", "B3") to database TeamPlayer records
 * via team assignment + jersey number, then increments their career stats.
 *
 * @param prisma - Prisma client instance
 * @param gameState - The completed game state containing matchStats and players
 * @param teamAId - Database ID of team A
 * @param teamBId - Database ID of team B
 * @returns Number of players updated
 */
export async function persistMatchSPP(
  prisma: PrismaClient,
  gameState: GameStateForSPP,
  teamAId: string,
  teamBId: string,
): Promise<number> {
  const { matchStats, players } = gameState;

  if (!matchStats || Object.keys(matchStats).length === 0) {
    return 0;
  }

  // Load all TeamPlayer records for both teams
  const [teamAPlayers, teamBPlayers] = await Promise.all([
    prisma.teamPlayer.findMany({
      where: { teamId: teamAId },
      select: { id: true, number: true },
    }),
    prisma.teamPlayer.findMany({
      where: { teamId: teamBId },
      select: { id: true, number: true },
    }),
  ]);

  // Build lookup: game engine player ID -> database TeamPlayer ID
  const playerIdMap = new Map<string, string>();
  for (const dbPlayer of teamAPlayers) {
    playerIdMap.set(`A${dbPlayer.number}`, dbPlayer.id);
  }
  for (const dbPlayer of teamBPlayers) {
    playerIdMap.set(`B${dbPlayer.number}`, dbPlayer.id);
  }

  // Build one update per player: increment matchesPlayed + SPP stats if any
  const updates: Promise<unknown>[] = [];

  for (const gamePlayer of players) {
    const dbPlayerId = playerIdMap.get(gamePlayer.id);
    if (!dbPlayerId) continue;

    const stats = matchStats[gamePlayer.id];
    const earnedSPP = stats ? calculatePlayerSPP(stats) : 0;

    updates.push(
      prisma.teamPlayer.update({
        where: { id: dbPlayerId },
        data: {
          matchesPlayed: { increment: 1 },
          ...(stats
            ? {
                spp: { increment: earnedSPP },
                totalTouchdowns: { increment: stats.touchdowns },
                totalCasualties: { increment: stats.casualties },
                totalCompletions: { increment: stats.completions },
                totalInterceptions: { increment: stats.interceptions },
                totalMvpAwards: { increment: stats.mvp ? 1 : 0 },
              }
            : {}),
        },
      }),
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates as any);
  }

  return updates.length;
}
