import { prisma } from "../prisma";
import {
  processInducementsWithSelection,
  calculatePettyCash,
  processPrayersToNuffle,
  determineKickingTeam,
  enterSetupPhase,
  makeRNG,
} from "@bb/game-engine";
import type {
  ExtendedGameState,
  InducementSelection,
  InducementContext,
} from "@bb/game-engine";
import { getUserTeamSide } from "./turn-ownership";
import { broadcastGameState } from "./game-broadcast";

/**
 * In-memory store for pending inducement selections per match.
 * Key: matchId, Value: map of teamSide → selection
 */
const pendingSelections = new Map<string, Map<string, InducementSelection>>();

export interface InducementResult {
  success: boolean;
  status?: "waiting" | "processed";
  gameState?: ExtendedGameState;
  error?: string;
  code?: string;
}

/**
 * Process an inducement submission for an online match.
 * Stores the selection until both teams have submitted, then processes both.
 */
export async function processInducementSubmission(
  matchId: string,
  userId: string,
  selection: InducementSelection,
): Promise<InducementResult> {
  // Determine player's team side
  const userTeamSide = await getUserTeamSide(prisma as any, matchId, userId);
  if (!userTeamSide) {
    return {
      success: false,
      error: "Vous n'êtes pas un joueur de cette partie",
      code: "NOT_PLAYER",
    };
  }

  // Get the current game state
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { turns: { orderBy: { number: "asc" } } },
  });

  if (!match) {
    return { success: false, error: "Partie introuvable", code: "NOT_FOUND" };
  }

  const lastTurnWithState = [...match.turns]
    .reverse()
    .find((t: any) => t.payload?.gameState);
  if (!lastTurnWithState) {
    return { success: false, error: "État de jeu introuvable", code: "NO_STATE" };
  }

  let gameState = (lastTurnWithState as any).payload.gameState as ExtendedGameState;
  if (typeof gameState === "string") {
    gameState = JSON.parse(gameState as unknown as string);
  }

  if (gameState.preMatch?.phase !== "inducements") {
    return {
      success: false,
      error: "La partie n'est pas en phase d'inducements",
      code: "INVALID_PHASE",
    };
  }

  // Store this team's selection
  if (!pendingSelections.has(matchId)) {
    pendingSelections.set(matchId, new Map());
  }
  pendingSelections.get(matchId)!.set(userTeamSide, selection);

  const selections = pendingSelections.get(matchId)!;

  // Wait for both teams
  if (!selections.has("A") || !selections.has("B")) {
    return {
      success: true,
      status: "waiting",
    };
  }

  // Both teams have submitted — process inducements
  const selectionA = selections.get("A")!;
  const selectionB = selections.get("B")!;

  // Get team info for context
  const teamSelections = await prisma.teamSelection.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    include: {
      teamRef: { select: { roster: true, treasury: true, currentValue: true } },
    },
  });

  const teamA = teamSelections[0]?.teamRef;
  const teamB = teamSelections[1]?.teamRef;

  const ctvA = (teamA as any)?.currentValue ?? 0;
  const ctvB = (teamB as any)?.currentValue ?? 0;

  const pettyCashInput = {
    ctvTeamA: ctvA,
    ctvTeamB: ctvB,
    treasuryTeamA: (teamA as any)?.treasury || 0,
    treasuryTeamB: (teamB as any)?.treasury || 0,
  };

  const ctxA: InducementContext = {
    teamId: "A",
    regionalRules: [],
    hasApothecary: gameState.apothecaryAvailable?.teamA ?? false,
    rosterSlug: teamA?.roster || "",
  };
  const ctxB: InducementContext = {
    teamId: "B",
    regionalRules: [],
    hasApothecary: gameState.apothecaryAvailable?.teamB ?? false,
    rosterSlug: teamB?.roster || "",
  };

  const result = processInducementsWithSelection(
    gameState,
    pettyCashInput,
    selectionA,
    selectionB,
    ctxA,
    ctxB,
  );

  if (!result.validationA.valid || !result.validationB.valid) {
    // Clear pending selections so they can resubmit
    pendingSelections.delete(matchId);
    const errors = [...result.validationA.errors, ...result.validationB.errors];
    return {
      success: false,
      error: errors.join("; "),
      code: "VALIDATION_ERROR",
    };
  }

  gameState = result.state;

  // Continue pre-match sequence
  const rng = makeRNG(`${match.seed}-inducements`);
  const ctvDiff = ctvA - ctvB;

  if (gameState.preMatch.phase === "prayers") {
    gameState = processPrayersToNuffle(gameState, rng, ctvDiff);
  }
  if (gameState.preMatch.phase === "kicking-team") {
    gameState = determineKickingTeam(gameState, rng);
  }
  if (gameState.preMatch.phase === "setup") {
    gameState = enterSetupPhase(gameState, gameState.preMatch.receivingTeam);
  }

  // Persist the new state
  const turnNumber = match.turns.length + 1;
  await prisma.turn.create({
    data: {
      matchId,
      number: turnNumber,
      payload: {
        type: "inducements",
        gameState,
        timestamp: new Date().toISOString(),
      },
    },
  });

  // Update match status
  const isReady =
    gameState.preMatch.phase === "setup" ||
    gameState.preMatch.phase === "kickoff";
  if (isReady) {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: "active" },
    });
  }

  // Broadcast to all connected clients
  broadcastGameState(matchId, gameState, { type: "inducements" } as any, userId);

  // Clean up pending selections
  pendingSelections.delete(matchId);

  return {
    success: true,
    status: "processed",
    gameState,
  };
}
