import type { PrismaClient } from "@prisma/client";
import type { CasualtyOutcome, LastingInjuryType, LastingInjuryDetail } from "@bb/game-engine";
import {
  applyCharacteristicReduction,
  isAtCharacteristicReductionFloor,
  type CharacteristicKind,
  type PlayerStats,
} from "@bb/game-engine";

export interface GameStateForInjuries {
  casualtyResults: Record<string, CasualtyOutcome>;
  lastingInjuryDetails: Record<string, LastingInjuryDetail>;
  players: Array<{
    id: string;
    team: string;
    number: number;
  }>;
}

/**
 * Map a LastingInjuryType to the Prisma field increment.
 */
function getInjuryUpdate(injuryType: LastingInjuryType): Record<string, { increment: number }> {
  switch (injuryType) {
    case 'niggling': return { nigglingInjuries: { increment: 1 } };
    case '-1ma': return { maReduction: { increment: 1 } };
    case '-1st': return { stReduction: { increment: 1 } };
    case '-1ag': return { agReduction: { increment: 1 } };
    case '-1pa': return { paReduction: { increment: 1 } };
    case '-1av': return { avReduction: { increment: 1 } };
  }
}

/** Caractéristique visée par une lasting injury '-1xx' (null pour niggling). */
function statForInjury(injuryType: LastingInjuryType): CharacteristicKind | null {
  switch (injuryType) {
    case '-1ma': return 'ma';
    case '-1st': return 'st';
    case '-1ag': return 'ag';
    case '-1pa': return 'pa';
    case '-1av': return 'av';
    default: return null;
  }
}

/**
 * Persist permanent injuries from a completed match to the database.
 *
 * Reads lastingInjuryDetails from the game state, identifies players with
 * serious_injury (niggling) or lasting_injury (stat reduction), and updates
 * the corresponding TeamPlayer records.
 *
 * Also sets missNextMatch for seriously_hurt, serious_injury, and lasting_injury.
 *
 * @param prisma - Prisma client instance
 * @param gameState - The completed game state containing lastingInjuryDetails
 * @param teamAId - Database ID of team A
 * @param teamBId - Database ID of team B
 * @returns Number of players updated with permanent injuries
 */
export async function persistPermanentInjuries(
  prisma: PrismaClient,
  gameState: GameStateForInjuries,
  teamAId: string,
  teamBId: string,
): Promise<number> {
  const { lastingInjuryDetails, casualtyResults, players } = gameState;

  if (!lastingInjuryDetails || Object.keys(lastingInjuryDetails).length === 0) {
    return 0;
  }

  // Collect players that need injury updates
  const injuredPlayerIds = Object.keys(lastingInjuryDetails);
  if (injuredPlayerIds.length === 0) {
    return 0;
  }

  // Load all TeamPlayer records for both teams (stats incluses : une
  // lasting injury mute la caractéristique de base, cf. A68 ci-dessous).
  const playerSelect = {
    id: true,
    number: true,
    ma: true,
    st: true,
    ag: true,
    pa: true,
    av: true,
  } as const;
  const [teamAPlayers, teamBPlayers] = (await Promise.all([
    prisma.teamPlayer.findMany({
      where: { teamId: teamAId },
      select: playerSelect,
    }),
    prisma.teamPlayer.findMany({
      where: { teamId: teamBId },
      select: playerSelect,
    }),
  ])) as Array<
    Array<{
      id: string;
      number: number;
      ma: number;
      st: number;
      ag: number;
      pa: number | null;
      av: number;
    }>
  >;

  // Build lookup: game engine player ID -> database TeamPlayer ID + stats
  const playerIdMap = new Map<string, string>();
  const statsByDbId = new Map<string, PlayerStats>();
  for (const dbPlayer of teamAPlayers) {
    playerIdMap.set(`A${dbPlayer.number}`, dbPlayer.id);
  }
  for (const dbPlayer of teamBPlayers) {
    playerIdMap.set(`B${dbPlayer.number}`, dbPlayer.id);
  }
  for (const dbPlayer of [...teamAPlayers, ...teamBPlayers]) {
    statsByDbId.set(dbPlayer.id, {
      ma: dbPlayer.ma,
      st: dbPlayer.st,
      ag: dbPlayer.ag,
      pa: dbPlayer.pa,
      av: dbPlayer.av,
    });
  }

  // Build update operations
  const updates: Promise<unknown>[] = [];

  for (const gamePlayerId of injuredPlayerIds) {
    const dbPlayerId = playerIdMap.get(gamePlayerId);
    if (!dbPlayerId) continue;

    const detail = lastingInjuryDetails[gamePlayerId];
    const outcome = detail.outcome;

    // Build the update data
    const data: Record<string, unknown> = {};

    // Apply missNextMatch for seriously_hurt, serious_injury, lasting_injury
    if (detail.missNextMatch) {
      data.missNextMatch = true;
    }

    // Apply specific injury for serious_injury (niggling) and lasting_injury (stat reduction)
    if (outcome === 'serious_injury') {
      // Niggling injury
      data.nigglingInjuries = { increment: 1 };
    } else if (outcome === 'lasting_injury') {
      // A68 — la lasting injury mute la caractéristique de base (comme le
      // chemin offline, cf. buildInjuryUpdate) : le compteur xxReduction
      // seul n'était consommé nulle part, le prochain match repartait des
      // caracs intactes. Carac déjà au plancher BB2025 : MNG seul, ni
      // compteur ni carac.
      const stat = statForInjury(detail.injuryType);
      const stats = statsByDbId.get(dbPlayerId);
      if (stat && stats) {
        const current = stat === 'pa' ? stats.pa : stats[stat];
        if (!isAtCharacteristicReductionFloor(stat, current)) {
          const reduced = applyCharacteristicReduction(stats, stat);
          statsByDbId.set(dbPlayerId, reduced);
          Object.assign(data, getInjuryUpdate(detail.injuryType));
          data[stat] = stat === 'pa' ? reduced.pa : reduced[stat];
        }
      } else {
        // niggling arrivée via lasting_injury (défensif) : compteur seul.
        Object.assign(data, getInjuryUpdate(detail.injuryType));
      }
    }

    if (Object.keys(data).length > 0) {
      updates.push(
        prisma.teamPlayer.update({
          where: { id: dbPlayerId },
          data,
        }),
      );
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates as any);
  }

  return updates.length;
}
