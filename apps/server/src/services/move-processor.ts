import { prisma } from "../prisma";
import { applyMove, makeRNG, isMatchEnded } from "@bb/game-engine";
import type { Move, ExtendedGameState } from "@bb/game-engine";
import { getUserTeamSide } from "./turn-ownership";
import { persistMatchSPP } from "./spp-tracking";
import { persistPlayerDeaths } from "./player-death";
import { persistPermanentInjuries } from "./permanent-injuries";
import { broadcastGameState, broadcastMatchEnd } from "./game-broadcast";
import { updateEloAfterMatch } from "./elo-update";
import { sendTurnPush } from "./push-notifications";
import { isUserConnectedToMatch } from "./connected-users";
import { handleTurnTimerAfterMove } from "./turn-timer-orchestrator";
import { FULL_RULES } from "@bb/game-engine";
import { scheduleAILoop } from "./ai-loop";
import { runAISetupIfNeeded } from "./ai-setup";
import { runAIKickoffIfNeeded } from "./ai-kickoff";
import { recordLeagueMatchResult } from "./league-match-result";

export interface MoveResult {
  success: true;
  gameState: ExtendedGameState;
  isMyTurn: boolean;
  moveCount: number;
}

export interface MoveError {
  success: false;
  error: string;
  code: "NOT_FOUND" | "INVALID_STATUS" | "NOT_PLAYER" | "NO_STATE" | "NOT_YOUR_TURN" | "ENGINE_ERROR";
}

interface AggregatedMatchStats {
  scoreA: number;
  scoreB: number;
  casA: number;
  casB: number;
}

/**
 * Compute the team-level stats needed by league standings (L.7).
 * Mirrors the aggregation performed by GET /match/:id/results so the
 * ladder and the results screen stay in sync.
 */
function aggregateMatchStats(state: ExtendedGameState): AggregatedMatchStats {
  const raw = state as unknown as {
    score?: { teamA?: number; teamB?: number };
    matchStats?: Record<string, { casualties?: number }>;
    players?: Array<{ id: string; team?: string }>;
  };
  const score = raw.score ?? {};
  const stats = raw.matchStats ?? {};
  const players = raw.players ?? [];

  let casA = 0;
  let casB = 0;
  for (const p of players) {
    const entry = stats[p.id];
    if (!entry) continue;
    if (p.team === "A") casA += entry.casualties ?? 0;
    else if (p.team === "B") casB += entry.casualties ?? 0;
  }

  return {
    scoreA: score.teamA ?? 0,
    scoreB: score.teamB ?? 0,
    casA,
    casB,
  };
}

/**
 * Process a game move for a given match and user.
 * Shared by both the REST endpoint and the WebSocket handler.
 */
export async function processMove(
  matchId: string,
  userId: string,
  move: Move,
): Promise<MoveResult | MoveError> {
  // Load the match with turns
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { turns: { orderBy: { number: "asc" } } },
  });

  if (!match) {
    return { success: false, error: "Partie introuvable", code: "NOT_FOUND" };
  }

  if (match.status !== "active") {
    return {
      success: false,
      error: `Statut invalide: ${match.status}. Le match doit etre actif.`,
      code: "INVALID_STATUS",
    };
  }

  // Determine player's team side (A or B)
  const userTeamSide = await getUserTeamSide(prisma as any, matchId, userId);
  if (!userTeamSide) {
    return {
      success: false,
      error: "Vous n'etes pas un joueur de cette partie",
      code: "NOT_PLAYER",
    };
  }

  // Get the last game state from turns
  const lastTurnWithState = [...match.turns]
    .reverse()
    .find((t: any) => t.payload?.gameState);
  if (!lastTurnWithState) {
    return { success: false, error: "Etat de jeu introuvable", code: "NO_STATE" };
  }

  let gameState = (lastTurnWithState as any).payload.gameState;
  if (typeof gameState === "string") {
    gameState = JSON.parse(gameState);
  }

  // Verify it's this player's turn
  if (gameState.currentPlayer !== userTeamSide) {
    return {
      success: false,
      error: `Ce n'est pas votre tour. C'est au tour de l'equipe ${gameState.currentPlayer}.`,
      code: "NOT_YOUR_TURN",
    };
  }

  // Track previous player for turn timer logic
  const prevPlayer = gameState.currentPlayer;

  // Deterministic RNG seeded by move count
  const moveCount = match.turns.filter(
    (t: any) => t.payload?.type === "gameplay-move",
  ).length;
  const rng = makeRNG(`${match.seed}-move-${moveCount}`);

  // Apply the move
  let newState: ExtendedGameState;
  try {
    newState = applyMove(gameState, move, rng) as ExtendedGameState;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur moteur de jeu";
    return { success: false, error: message, code: "ENGINE_ERROR" };
  }

  // Persist the new state as a Turn
  const turnNumber = match.turns.length + 1;
  await prisma.turn.create({
    data: {
      matchId,
      number: turnNumber,
      payload: {
        type: "gameplay-move",
        userId,
        move,
        gameState: newState,
        timestamp: new Date().toISOString(),
      },
    },
  });

  // Determine next player
  const nextTeamSide = newState.currentPlayer;
  const selections = await prisma.teamSelection.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const nextUserId = nextTeamSide === "A"
    ? selections[0]?.userId
    : selections[1]?.userId;

  // N.2 — Check if match ended (honors rulesConfig.turnsPerHalf: 8 in full, 6 in simplified)
  const matchEnded = isMatchEnded(newState);
  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(matchEnded ? { status: "ended" } : {}),
      currentTurnUserId: matchEnded ? null : (nextUserId || null),
      lastMoveAt: new Date(),
    },
  });

  // Persist post-match data when the match ends
  if (matchEnded && newState.players) {
    const teamSelections = await prisma.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      select: { teamId: true, userId: true },
    });
    const teamAId = teamSelections[0]?.teamId;
    const teamBId = teamSelections[1]?.teamId;

    if (teamAId && teamBId) {
      try {
        if (newState.matchStats) {
          await persistMatchSPP(prisma as any, newState, teamAId, teamBId);
        }
      } catch {
        // SPP persistence error — non-blocking
      }

      try {
        if (newState.casualtyResults) {
          await persistPlayerDeaths(prisma as any, newState, teamAId, teamBId);
        }
      } catch {
        // Death persistence error — non-blocking
      }

      try {
        if (newState.lastingInjuryDetails) {
          await persistPermanentInjuries(prisma as any, newState, teamAId, teamBId);
        }
      } catch {
        // Injury persistence error — non-blocking
      }

      // Update ELO ratings based on match result
      const userAId = teamSelections[0]?.userId;
      const userBId = teamSelections[1]?.userId;
      if (userAId && userBId && newState.score) {
        try {
          await updateEloAfterMatch(
            prisma as any,
            userAId,
            userBId,
            newState.score.teamA,
            newState.score.teamB,
          );
        } catch {
          // ELO update error — non-blocking
        }
      }

      // Persist winnings (treasury) and dedicated fans changes
      if (newState.matchResult) {
        const { winnings, dedicatedFansChange } = newState.matchResult;

        try {
          if (winnings) {
            await prisma.team.update({
              where: { id: teamAId },
              data: { treasury: { increment: winnings.teamA } },
            });
            await prisma.team.update({
              where: { id: teamBId },
              data: { treasury: { increment: winnings.teamB } },
            });
          }
        } catch {
          // Treasury update error — non-blocking
        }

        try {
          if (dedicatedFansChange) {
            if (dedicatedFansChange.teamA !== 0) {
              await prisma.team.update({
                where: { id: teamAId },
                data: { dedicatedFans: { increment: dedicatedFansChange.teamA } },
              });
            }
            if (dedicatedFansChange.teamB !== 0) {
              await prisma.team.update({
                where: { id: teamBId },
                data: { dedicatedFans: { increment: dedicatedFansChange.teamB } },
              });
            }
          }
        } catch {
          // Dedicated fans update error — non-blocking
        }
      }

      // L.7 — report the match result to league standings if the match
      // is attached to a LeagueSeason. Non-blocking: if the ladder
      // update fails, the match is still considered finished and the
      // league service can reconcile later.
      try {
        const { scoreA, scoreB, casA, casB } = aggregateMatchStats(newState);
        await recordLeagueMatchResult({
          matchId,
          scoreA,
          scoreB,
          casualtiesA: casA,
          casualtiesB: casB,
        });
      } catch {
        // League integration error — non-blocking
      }
    }
  }

  // Broadcast to all connected players
  broadcastGameState(matchId, newState, move, userId);

  // Send push notification when it becomes another player's turn,
  // but only if they are NOT already connected via WebSocket (G.3)
  if (!matchEnded && nextUserId && nextUserId !== userId) {
    if (!isUserConnectedToMatch(matchId, nextUserId)) {
      sendTurnPush(nextUserId, matchId);
    }
  }

  if (matchEnded) {
    broadcastMatchEnd(matchId, newState);
  }

  // Manage turn timer: start/reset on turn change, cancel on match end
  const turnTimerSecs = newState.turnTimerSeconds ?? FULL_RULES.turnTimerSeconds;
  handleTurnTimerAfterMove(
    matchId,
    prevPlayer,
    newState.currentPlayer,
    turnTimerSecs,
    matchEnded ? "ended" : newState.gamePhase,
    nextUserId ?? undefined,
  );

  // Practice vs AI — route to the right handler depending on the phase.
  // After a touchdown, `handlePostTouchdown` brings the state back into
  // `preMatch.phase === 'setup'` so the next drive can be staged. In that
  // shape `scheduleAILoop` would call `computeAIMove`, which has no setup
  // logic and returns null → forced END_TURN, leaving `currentCoach` and
  // `currentPlayer` desynchronised and the match unrecoverable. We dispatch
  // to the dedicated AI helpers (setup → kickoff ball placement) and only
  // fall back to the gameplay loop once we are out of those phases.
  if (
    !matchEnded &&
    match.aiOpponent &&
    match.aiTeamSide
  ) {
    let postState = newState;
    if (
      postState.preMatch?.phase === "setup" &&
      postState.preMatch.currentCoach === match.aiTeamSide
    ) {
      const setupReport = await runAISetupIfNeeded(matchId, prisma as any);
      if (setupReport.ran && setupReport.gameState) {
        postState = setupReport.gameState as ExtendedGameState;
      }
    }
    if (
      postState.preMatch?.phase === "kickoff-sequence" &&
      postState.preMatch.kickoffStep === "place-ball" &&
      postState.preMatch.kickingTeam === match.aiTeamSide
    ) {
      const kickoffReport = await runAIKickoffIfNeeded(matchId, prisma as any);
      if (kickoffReport.ran && kickoffReport.gameState) {
        postState = kickoffReport.gameState as ExtendedGameState;
      }
    }
    if (
      !postState.preMatch &&
      postState.currentPlayer === match.aiTeamSide
    ) {
      scheduleAILoop(matchId);
    }

    // After AI setup/kickoff helpers, the active coach (or the gameplay
    // currentPlayer) may now be the human. Keep currentTurnUserId in sync
    // so the human client is unblocked.
    if (postState !== newState) {
      const activeTeam = postState.preMatch?.currentCoach ?? postState.currentPlayer;
      const updatedUserId = activeTeam === "A"
        ? selections[0]?.userId
        : selections[1]?.userId;
      if (updatedUserId && updatedUserId !== nextUserId) {
        await prisma.match.update({
          where: { id: matchId },
          data: { currentTurnUserId: updatedUserId, lastMoveAt: new Date() },
        });
      }
    }
  }

  const isMyTurn = newState.currentPlayer === userTeamSide;

  return {
    success: true,
    gameState: newState,
    isMyTurn,
    moveCount: moveCount + 1,
  };
}
