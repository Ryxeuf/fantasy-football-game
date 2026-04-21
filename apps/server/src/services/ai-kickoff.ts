/**
 * Server-side AI kickoff ball placement.
 *
 * Fixes the bug where an online practice match hangs on the kickoff
 * `place-ball` step when the AI is the kicking team: no client submits on
 * behalf of the AI, so the sequence never advances. This service picks a
 * legal ball position (centre of the receiving half), applies
 * `placeKickoffBall`, persists the resulting state, and broadcasts it.
 *
 * Idempotent: bails out if the AI is not the kicking team, if the phase is
 * not `kickoff-sequence`, or if the kickoff step is past `place-ball`.
 */
import {
  pickAIKickoffBallPosition,
  placeKickoffBall,
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

export interface RunAIKickoffReport {
  readonly ran: boolean;
  readonly reason:
    | "not-ai-match"
    | "no-state"
    | "not-kickoff-phase"
    | "not-place-ball-step"
    | "not-ai-kicking"
    | "invalid-placement"
    | "placed";
  readonly gameState?: ExtendedGameState;
}

export async function runAIKickoffIfNeeded(
  matchId: string,
  db: PrismaLike = prisma as any,
): Promise<RunAIKickoffReport> {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match?.aiOpponent || !match.aiTeamSide || !match.aiUserId) {
    return { ran: false, reason: "not-ai-match" };
  }

  const aiTeam = match.aiTeamSide as TeamId;
  const aiUserId = match.aiUserId as string;

  const state = await loadLatestGameState(db, matchId);
  if (!state) {
    return { ran: false, reason: "no-state" };
  }

  if (state.preMatch?.phase !== "kickoff-sequence") {
    return { ran: false, reason: "not-kickoff-phase" };
  }
  if (state.preMatch.kickoffStep !== "place-ball") {
    return { ran: false, reason: "not-place-ball-step" };
  }
  if (state.preMatch.kickingTeam !== aiTeam) {
    return { ran: false, reason: "not-ai-kicking" };
  }

  const position = pickAIKickoffBallPosition(state, aiTeam);
  let nextState = placeKickoffBall(state, position);

  // `placeKickoffBall` returns the input state untouched when the position
  // is illegal. Guard against regressions in the helper.
  if (nextState.preMatch.kickoffStep !== "kick-deviation") {
    return { ran: false, reason: "invalid-placement", gameState: state };
  }

  // Mirror the human endpoint: expose the ball position for frontend rendering.
  if (nextState.preMatch.ballPosition) {
    nextState = {
      ...nextState,
      ball: nextState.preMatch.ballPosition,
    } as ExtendedGameState;
  }

  await persistAIKickoffTurn(db, matchId, aiUserId, position, nextState);
  broadcastGameState(
    matchId,
    nextState,
    { type: "place-kickoff-ball" } as any,
    aiUserId,
  );

  return { ran: true, reason: "placed", gameState: nextState };
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

async function persistAIKickoffTurn(
  db: PrismaLike,
  matchId: string,
  aiUserId: string,
  position: { x: number; y: number },
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
        type: "place-kickoff-ball",
        userId: aiUserId,
        position,
        gameState,
        ai: true,
        timestamp: new Date().toISOString(),
      } as any,
    },
  });
}
