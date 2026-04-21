/**
 * Server-side AI auto-placement during the `setup` phase.
 *
 * Fixes the bug where an online practice match would hang on the placement
 * step: no client submits on behalf of the AI, so the phase never advances.
 * This service places the AI's 11 players in legal positions, validates the
 * placement, and (when both coaches are done) transitions to the kickoff
 * sequence. It can run twice in a row if the AI needs to place both as
 * receivingTeam and kickingTeam.
 *
 * Idempotent: if the AI's players are already on the pitch, or if it is not
 * the AI's turn to place, the service exits without mutating state.
 */
import {
  autoSetupAITeam,
  startKickoffSequence,
  validatePlayerPlacement,
  type ExtendedGameState,
  type TeamId,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { broadcastGameState } from "./game-broadcast";

type PrismaLike = {
  match: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  turn: {
    findMany: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
  };
};

export interface RunAISetupReport {
  readonly ran: boolean;
  readonly reason:
    | "not-ai-match"
    | "no-state"
    | "not-setup-phase"
    | "not-ai-turn"
    | "placed";
  readonly gameState?: ExtendedGameState;
}

const MAX_AI_SETUP_ITERATIONS = 2;

export async function runAISetupIfNeeded(
  matchId: string,
  db: PrismaLike = prisma as any,
): Promise<RunAISetupReport> {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match?.aiOpponent || !match.aiTeamSide || !match.aiUserId) {
    return { ran: false, reason: "not-ai-match" };
  }

  const aiTeam = match.aiTeamSide as TeamId;
  const aiUserId = match.aiUserId as string;

  let state = await loadLatestGameState(db, matchId);
  if (!state) {
    return { ran: false, reason: "no-state" };
  }

  if (state.preMatch?.phase !== "setup") {
    return { ran: false, reason: "not-setup-phase" };
  }

  let ran = false;
  for (let i = 0; i < MAX_AI_SETUP_ITERATIONS; i += 1) {
    if (state.preMatch.phase !== "setup") break;
    if (state.preMatch.currentCoach !== aiTeam) break;

    const alreadyPlaced = state.players.filter(
      (p) => p.team === aiTeam && p.pos.x >= 0,
    ).length;
    if (alreadyPlaced < 11) {
      state = autoSetupAITeam(state, aiTeam);
    }

    const placedCount = state.players.filter(
      (p) => p.team === aiTeam && p.pos.x >= 0,
    ).length;
    if (placedCount < 11) {
      break;
    }

    let nextState = validatePlayerPlacement(state);
    if (nextState.preMatch.phase === "kickoff") {
      nextState = startKickoffSequence(nextState) as ExtendedGameState;
    }

    await persistValidateSetupTurn(db, matchId, aiUserId, nextState);
    broadcastGameState(
      matchId,
      nextState,
      { type: "validate-setup" } as any,
      aiUserId,
    );

    state = nextState;
    ran = true;

    if (
      nextState.preMatch.phase === "kickoff" ||
      nextState.preMatch.phase === "kickoff-sequence"
    ) {
      await db.match.update({
        where: { id: matchId },
        data: { status: "active" },
      });
      break;
    }
  }

  if (!ran) {
    return { ran: false, reason: "not-ai-turn", gameState: state };
  }

  return { ran: true, reason: "placed", gameState: state };
}

async function loadLatestGameState(
  db: PrismaLike,
  matchId: string,
): Promise<ExtendedGameState | null> {
  const turns = await db.turn.findMany({
    where: { matchId },
    orderBy: { number: "asc" },
  });
  const latest = [...turns].reverse().find((t: any) => t.payload?.gameState);
  if (!latest) return null;
  const raw = (latest as any).payload.gameState;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function persistValidateSetupTurn(
  db: PrismaLike,
  matchId: string,
  aiUserId: string,
  gameState: ExtendedGameState,
): Promise<void> {
  const turns = await db.turn.findMany({
    where: { matchId },
    orderBy: { number: "asc" },
    select: { number: true },
  });
  const nextNumber = (turns[turns.length - 1]?.number ?? 0) + 1;
  await db.turn.create({
    data: {
      matchId,
      number: nextNumber,
      payload: {
        type: "validate-setup",
        userId: aiUserId,
        ai: true,
        gameState,
        timestamp: new Date().toISOString(),
      } as any,
    },
  });
}
