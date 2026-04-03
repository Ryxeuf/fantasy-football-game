import { prisma } from "../prisma";
import { applyMove, makeRNG } from "@bb/game-engine";
import type { Move, ExtendedGameState } from "@bb/game-engine";
import { getUserTeamSide } from "./turn-ownership";
import { persistMatchSPP } from "./spp-tracking";
import { persistPlayerDeaths } from "./player-death";
import { persistPermanentInjuries } from "./permanent-injuries";
import { broadcastGameState, broadcastMatchEnd } from "./game-broadcast";

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

  // Check if match ended (half 2, turn > 8)
  const matchEnded = newState.half === 2 && newState.turn > 8 && newState.isTurnover;
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
      select: { teamId: true },
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
    }
  }

  // Broadcast to all connected players
  broadcastGameState(matchId, newState, move, userId);

  if (matchEnded) {
    broadcastMatchEnd(matchId, newState);
  }

  const isMyTurn = newState.currentPlayer === userTeamSide;

  return {
    success: true,
    gameState: newState,
    isMyTurn,
    moveCount: moveCount + 1,
  };
}
