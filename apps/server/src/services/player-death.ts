import type { PrismaClient } from "@prisma/client";
import type { CasualtyOutcome } from "@bb/game-engine";

export interface GameStateForDeaths {
  casualtyResults: Record<string, CasualtyOutcome>;
  players: Array<{
    id: string;
    team: string;
    number: number;
  }>;
}

/**
 * Persist player deaths from a completed match to the database.
 *
 * Reads casualtyResults from the game state, identifies players with 'dead' outcome,
 * and marks the corresponding TeamPlayer records as dead.
 *
 * @param prisma - Prisma client instance
 * @param gameState - The completed game state containing casualtyResults and players
 * @param teamAId - Database ID of team A
 * @param teamBId - Database ID of team B
 * @returns Number of players marked as dead
 */
export async function persistPlayerDeaths(
  prisma: PrismaClient,
  gameState: GameStateForDeaths,
  teamAId: string,
  teamBId: string,
): Promise<number> {
  const { casualtyResults, players } = gameState;

  if (!casualtyResults || Object.keys(casualtyResults).length === 0) {
    return 0;
  }

  // Find players who died
  const deadPlayerIds = Object.entries(casualtyResults)
    .filter(([, outcome]) => outcome === "dead")
    .map(([playerId]) => playerId);

  if (deadPlayerIds.length === 0) {
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

  // Build update operations for dead players
  const now = new Date();
  const updates: Promise<unknown>[] = [];

  for (const gamePlayerId of deadPlayerIds) {
    const dbPlayerId = playerIdMap.get(gamePlayerId);
    if (!dbPlayerId) continue;

    updates.push(
      prisma.teamPlayer.update({
        where: { id: dbPlayerId },
        data: {
          dead: true,
          diedAt: now,
        },
      }),
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates as any);
  }

  return updates.length;
}
