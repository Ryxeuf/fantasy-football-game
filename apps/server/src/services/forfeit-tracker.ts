import { prisma } from "../prisma";
import { broadcastMatchForfeited } from "./game-broadcast";
import { updateEloAfterMatch } from "./elo-update";
import { recordLeagueMatchResult } from "./league-match-result";

/** Forfeit timeout: 2 minutes of disconnection. */
export const FORFEIT_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Active forfeit timers indexed by "matchId:userId".
 * Each value is a NodeJS.Timeout that fires the forfeit logic.
 */
const forfeitTimers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(matchId: string, userId: string): string {
  return `${matchId}:${userId}`;
}

/**
 * Start a forfeit countdown for a disconnected player.
 * If the player does not reconnect within FORFEIT_TIMEOUT_MS,
 * the match ends with the disconnected player losing by forfeit.
 */
export function startForfeitTimer(matchId: string, userId: string): void {
  const key = timerKey(matchId, userId);

  // Don't create a duplicate timer
  if (forfeitTimers.has(key)) {
    return;
  }

  const timer = setTimeout(() => {
    forfeitTimers.delete(key);
    void executeForfeit(matchId, userId);
  }, FORFEIT_TIMEOUT_MS);

  forfeitTimers.set(key, timer);
}

/**
 * Cancel a pending forfeit timer (e.g. when the player reconnects).
 */
export function cancelForfeitTimer(matchId: string, userId: string): void {
  const key = timerKey(matchId, userId);
  const timer = forfeitTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    forfeitTimers.delete(key);
  }
}

/** Get the set of active forfeit timer keys (for testing). */
export function getActiveForfeitTimers(): Map<string, ReturnType<typeof setTimeout>> {
  return forfeitTimers;
}

/** Clear all forfeit timers (for testing). */
export function resetForfeitTimers(): void {
  for (const timer of forfeitTimers.values()) {
    clearTimeout(timer);
  }
  forfeitTimers.clear();
}

/**
 * Execute forfeit: end the match with the disconnected player as the loser.
 * Called internally when the timer fires.
 */
async function executeForfeit(matchId: string, forfeitingUserId: string): Promise<void> {
  // Verify match is still active
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true },
  });

  if (!match || match.status !== "active") {
    return;
  }

  // Get team selections to determine sides
  const selections = await prisma.teamSelection.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    select: { userId: true, teamId: true },
  });

  if (selections.length < 2) {
    return;
  }

  const forfeitingTeamSide = selections[0].userId === forfeitingUserId ? "A" : "B";
  const winnerTeamSide = forfeitingTeamSide === "A" ? "B" : "A";

  // Get current game state from last turn
  const turns = await prisma.turn.findMany({
    where: { matchId },
    orderBy: { number: "desc" },
    take: 1,
  });

  const lastTurn = turns[0];
  const currentGameState = lastTurn?.payload?.gameState ?? {
    score: { teamA: 0, teamB: 0 },
    gamePhase: "playing",
  };

  // Build the forfeit game state
  const forfeitState = {
    ...currentGameState,
    gamePhase: "ended" as const,
    matchResult: {
      winner: winnerTeamSide,
      forfeit: true,
      forfeitingUserId,
      spp: {},
    },
  };

  // Persist forfeit turn
  const turnNumber = lastTurn ? lastTurn.number + 1 : 1;
  await prisma.turn.create({
    data: {
      matchId,
      number: turnNumber,
      payload: {
        type: "forfeit",
        forfeitingUserId,
        gameState: forfeitState,
        timestamp: new Date().toISOString(),
      },
    },
  });

  // End the match
  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: "ended",
      currentTurnUserId: null,
    },
  });

  // Update ELO: forfeiting player gets a loss (0-1)
  const userAId = selections[0].userId;
  const userBId = selections[1].userId;
  const scoreA = forfeitingTeamSide === "A" ? 0 : 1;
  const scoreB = forfeitingTeamSide === "A" ? 1 : 0;

  try {
    await updateEloAfterMatch(prisma as any, userAId, userBId, scoreA, scoreB);
  } catch {
    // ELO update error — non-blocking
  }

  // L.7 — report forfeit to league standings (non-blocking).
  // Scores are synthetic (1-0 for the winner), no casualties inflicted.
  try {
    await recordLeagueMatchResult({
      matchId,
      scoreA,
      scoreB,
      casualtiesA: 0,
      casualtiesB: 0,
    });
  } catch {
    // League integration error — non-blocking, the ladder can be
    // reconciled later via a maintenance task.
  }

  // Broadcast forfeit to all connected players
  broadcastMatchForfeited(matchId, forfeitingUserId, forfeitState);
}
