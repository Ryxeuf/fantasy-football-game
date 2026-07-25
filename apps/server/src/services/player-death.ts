import type { PrismaClient } from "@prisma/client";
import type { CasualtyOutcome } from "@bb/game-engine";
import { applyPlayerStatuses } from "./player-status";

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
 * La PROVENANCE (`matchId`) est enregistree quand elle est connue : c'est
 * elle qui rend la mort reversible si le match est annule ou supprime par
 * un admin (cf. `services/player-status.ts`). Sans `matchId`, on retombe
 * sur l'ecriture directe historique (mort non reversible) plutot que de
 * bloquer la fin de match.
 *
 * @param prisma - Prisma client instance
 * @param gameState - The completed game state containing casualtyResults and players
 * @param teamAId - Database ID of team A
 * @param teamBId - Database ID of team B
 * @param matchId - Id du match a l'origine des morts (provenance)
 * @returns Number of players marked as dead
 */
export async function persistPlayerDeaths(
  prisma: PrismaClient,
  gameState: GameStateForDeaths,
  teamAId: string,
  teamBId: string,
  matchId?: string,
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

  const dbPlayerIds = deadPlayerIds
    .map((gamePlayerId) => playerIdMap.get(gamePlayerId))
    .filter((id): id is string => Boolean(id));

  if (dbPlayerIds.length === 0) return 0;

  // Chemin nominal : statut + provenance + journal -> mort reversible si le
  // match est annule.
  if (matchId) {
    const { appliedIds } = await applyPlayerStatuses(dbPlayerIds, {
      kind: "death",
      source: "online_match",
      sourceId: matchId,
      allowedTeamIds: [teamAId, teamBId],
    });
    return appliedIds.length;
  }

  // Fallback sans provenance (callers legacy / tests) : ecriture directe.
  const now = new Date();
  await prisma.$transaction(
    dbPlayerIds.map((id) =>
      prisma.teamPlayer.update({
        where: { id },
        data: { dead: true, diedAt: now, status: "dead", statusAt: now },
      }),
    ) as any,
  );

  return dbPlayerIds.length;
}
