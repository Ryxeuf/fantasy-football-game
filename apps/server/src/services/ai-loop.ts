/**
 * Server-side AI move loop for online practice matches.
 *
 * Safeguards:
 *  - hard iteration cap (`MAX_MOVES_PER_TURN`)
 *  - wall-clock timeout (`MAX_MS_PER_TURN`)
 *  - in-memory per-match lock (`Map<matchId, Promise>`) to serialise loops
 *  - anti-stagnation hash on the subset of state that the AI mutates
 *  - null-move fallback: forces a single `END_TURN` then exits
 *  - fire-and-forget via `scheduleAILoop` (no await from the HTTP handler)
 */

import {
  applyMove,
  makeRNG,
  isMatchEnded,
  type ExtendedGameState,
  type GameState,
  type Move,
  type TeamId,
  type AIDifficulty,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { computeAIMove, isAITurnToAct } from "./ai-turn";
import { broadcastGameState, broadcastMatchEnd } from "./game-broadcast";
import { serverLog } from "../utils/server-log";

export const MAX_MOVES_PER_TURN = 64;
export const MAX_MS_PER_TURN = 15_000;

const locks = new Map<string, Promise<void>>();

export interface RunAILoopOptions {
  readonly matchId: string;
  readonly maxMoves?: number;
  readonly maxMs?: number;
  /** Override clock & rng for deterministic tests. */
  readonly now?: () => number;
  readonly seedPrefix?: string;
}

export interface AILoopReport {
  readonly movesApplied: number;
  readonly durationMs: number;
  readonly abortReason:
    | "turn-over"
    | "match-ended"
    | "no-ai-turn"
    | "max-moves"
    | "timeout"
    | "stagnation"
    | "no-legal-move"
    | "engine-error"
    | "not-configured";
}

interface PrismaLike {
  match: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  turn: {
    findMany: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
  };
  teamSelection: {
    findMany: (args: any) => Promise<any[]>;
  };
}

/** Cheap progress hash — enough to detect "AI is stuck on the same state". */
function hashProgress(state: GameState): string {
  const players = (state.players ?? [])
    .map((p: any) => `${p.id}:${p.pos?.x ?? -1},${p.pos?.y ?? -1}`)
    .join("|");
  return [
    state.currentPlayer,
    state.turn,
    state.half,
    state.score?.teamA ?? 0,
    state.score?.teamB ?? 0,
    players,
  ].join("#");
}

/** Fire-and-forget entrypoint used by `processMove`. */
export function scheduleAILoop(matchId: string): void {
  void runAILoop({ matchId }).catch((err) => {
    serverLog.error(`[ai-loop] ${matchId} failed:`, err);
  });
}

/**
 * Idempotent AI loop. Exits cleanly when:
 *   - the match is not configured for AI, or
 *   - it is no longer the AI's turn, or
 *   - one of the safeguards triggers.
 */
export async function runAILoop(
  options: RunAILoopOptions,
  db: PrismaLike = prisma as any,
): Promise<AILoopReport> {
  const { matchId } = options;
  // Coalesce concurrent runs for the same match.
  const existing = locks.get(matchId);
  if (existing) {
    await existing;
    return {
      movesApplied: 0,
      durationMs: 0,
      abortReason: "turn-over",
    };
  }
  let resolveLock!: () => void;
  const lock = new Promise<void>((r) => {
    resolveLock = r;
  });
  locks.set(matchId, lock);
  try {
    return await executeAILoop(options, db);
  } finally {
    locks.delete(matchId);
    resolveLock();
  }
}

async function executeAILoop(
  options: RunAILoopOptions,
  db: PrismaLike,
): Promise<AILoopReport> {
  const {
    matchId,
    maxMoves = MAX_MOVES_PER_TURN,
    maxMs = MAX_MS_PER_TURN,
    now = () => Date.now(),
    seedPrefix,
  } = options;

  const start = now();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || !match.aiOpponent || !match.aiTeamSide || !match.aiUserId || !match.aiDifficulty) {
    return { movesApplied: 0, durationMs: 0, abortReason: "not-configured" };
  }
  if (match.status !== "active") {
    return {
      movesApplied: 0,
      durationMs: now() - start,
      abortReason: "not-configured",
    };
  }

  const aiTeam = match.aiTeamSide as TeamId;
  const difficulty = match.aiDifficulty as AIDifficulty;
  const aiUserId = match.aiUserId as string;

  let state = await loadLatestGameState(db, matchId);
  if (!state) {
    return { movesApplied: 0, durationMs: now() - start, abortReason: "not-configured" };
  }

  let movesApplied = 0;
  let prevHash = hashProgress(state);
  let stagnantCount = 0;

  while (true) {
    if (movesApplied >= maxMoves) {
      return report("max-moves", start, now, movesApplied);
    }
    if (now() - start > maxMs) {
      return report("timeout", start, now, movesApplied);
    }
    if (isMatchEnded(state as ExtendedGameState)) {
      return report("match-ended", start, now, movesApplied);
    }
    if (!isAITurnToAct(state, aiTeam)) {
      return report(state.currentPlayer === aiTeam ? "no-ai-turn" : "turn-over", start, now, movesApplied);
    }

    const seed = `${seedPrefix ?? `ai-${matchId}`}-${movesApplied}`;
    const { move, isAITurn } = computeAIMove({
      state,
      aiTeam,
      difficulty,
      seed,
    });
    if (!isAITurn) {
      return report("turn-over", start, now, movesApplied);
    }

    const chosen: Move = move ?? ({ type: "END_TURN" } as Move);
    let nextState: ExtendedGameState;
    try {
      nextState = applyMove(state, chosen, makeRNG(seed)) as ExtendedGameState;
    } catch (err) {
      serverLog.error(`[ai-loop] ${matchId} applyMove failed`, err);
      return report("engine-error", start, now, movesApplied);
    }

    await persistAITurn(db, matchId, aiUserId, chosen, nextState);
    broadcastGameState(matchId, nextState, chosen, aiUserId);
    state = nextState;
    movesApplied += 1;

    const matchEnded = isMatchEnded(nextState);
    if (matchEnded) {
      await db.match.update({
        where: { id: matchId },
        data: { status: "ended", currentTurnUserId: null, lastMoveAt: new Date() },
      });
      broadcastMatchEnd(matchId, nextState);
      return report("match-ended", start, now, movesApplied);
    }

    // Update currentTurnUserId so the UI highlights the right side.
    const nextTeamSide = nextState.currentPlayer;
    if (nextTeamSide !== aiTeam) {
      const selections = await db.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      const nextUserId =
        nextTeamSide === "A"
          ? selections[0]?.userId
          : selections[1]?.userId;
      await db.match.update({
        where: { id: matchId },
        data: {
          currentTurnUserId: nextUserId ?? null,
          lastMoveAt: new Date(),
        },
      });
      return report("turn-over", start, now, movesApplied);
    }

    // If the AI returned null → we forced END_TURN, stop after this one move.
    if (!move) {
      return report("no-legal-move", start, now, movesApplied);
    }

    const nextHash = hashProgress(state);
    if (nextHash === prevHash) {
      stagnantCount += 1;
      if (stagnantCount >= 2) {
        return report("stagnation", start, now, movesApplied);
      }
    } else {
      stagnantCount = 0;
      prevHash = nextHash;
    }
  }
}

function report(
  abortReason: AILoopReport["abortReason"],
  start: number,
  now: () => number,
  movesApplied: number,
): AILoopReport {
  return { movesApplied, durationMs: now() - start, abortReason };
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

async function persistAITurn(
  db: PrismaLike,
  matchId: string,
  aiUserId: string,
  move: Move,
  gameState: ExtendedGameState,
): Promise<void> {
  const existing = await db.turn.findMany({
    where: { matchId },
    orderBy: { number: "asc" },
    select: { number: true },
  });
  const nextNumber = (existing[existing.length - 1]?.number ?? 0) + 1;
  await db.turn.create({
    data: {
      matchId,
      number: nextNumber,
      payload: {
        type: "gameplay-move",
        userId: aiUserId,
        move,
        gameState,
        ai: true,
        timestamp: new Date().toISOString(),
      } as any,
    },
  });
}
