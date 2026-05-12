/**
 * Sprint R — Lot R.E.1 : game mode async backend.
 *
 * Les matches en mode `async` n'exigent pas de socket : chaque coup est
 * commit via REST `POST /match/:id/move` (route existante), et un cron
 * deadline check force-end-turn si le joueur ne joue pas dans le delai
 * imparti (default 24h).
 *
 * Architecture
 * ------------
 * - `Match.mode` enum string ("realtime" | "async"). Defaut realtime
 *   pour 100% retro-compat.
 * - `Match.currentTurnDeadline` : DateTime nullable. Set par
 *   `markTurnDeadline` apres chaque move en mode async. Reset a null
 *   quand le match se termine.
 * - `Match.turnDeadlineHours` : duree par tour configurable (default 24h).
 *
 * Force end-turn
 * --------------
 * Quand un user ne joue pas avant deadline :
 * 1. Le cron `sweepExpiredAsyncMatches` les scan via index
 *    `(mode, currentTurnDeadline)`.
 * 2. `forceEndTurnOnDeadline(matchId)` :
 *    - Load le last gameState du match.
 *    - Apply `{ type: "END_TURN" }` via le game engine.
 *    - Persist nouveau Turn `{ forced: true, reason: "deadline" }`.
 *    - Update Match : currentTurnUserId, lastMoveAt, currentTurnDeadline.
 *
 * Idempotence : tout `forceEndTurnOnDeadline` re-verifie la deadline avant
 * d'agir (anti-double-trigger entre cron + manual call).
 */

import { applyMove, isMatchEnded, makeRNG } from "@bb/game-engine";
import type { Move } from "@bb/game-engine";

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

export const DEFAULT_TURN_DEADLINE_HOURS = 24;
export const MIN_TURN_DEADLINE_HOURS = 1;
export const MAX_TURN_DEADLINE_HOURS = 168; // 1 semaine

export type AsyncMatchErrorCode =
  | "MATCH_NOT_FOUND"
  | "MATCH_NOT_ASYNC"
  | "MATCH_NOT_ACTIVE"
  | "NO_GAMESTATE"
  | "DEADLINE_NOT_EXPIRED";

export class AsyncMatchError extends Error {
  constructor(
    public readonly code: AsyncMatchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AsyncMatchError";
  }
}

/**
 * Calcule une nouvelle deadline = `now + hours * 3600s`. Clamp dans
 * `[MIN, MAX]`.
 */
export function computeDeadline(now: Date, hours: number): Date {
  const clamped = Math.min(
    MAX_TURN_DEADLINE_HOURS,
    Math.max(MIN_TURN_DEADLINE_HOURS, hours),
  );
  return new Date(now.getTime() + clamped * 60 * 60 * 1000);
}

/**
 * Met a jour la deadline du tour courant. Appele par le hook
 * `move-processor` apres chaque move applique, uniquement si
 * `match.mode === "async"`. No-op si le match est termine
 * (status != "active") — on reset alors la deadline a `null`.
 */
export async function markTurnDeadline(
  matchId: string,
  opts: { now?: Date; matchEnded?: boolean } = {},
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { mode: true, turnDeadlineHours: true, status: true },
  });
  if (!match) return;
  if ((match.mode as string) !== "async") return;

  const now = opts.now ?? new Date();
  const isActive = (match.status as string) === "active" && !opts.matchEnded;
  const deadline = isActive
    ? computeDeadline(now, match.turnDeadlineHours as number)
    : null;

  await prisma.match.update({
    where: { id: matchId },
    data: { currentTurnDeadline: deadline },
  });
}

export interface ExpiredAsyncMatch {
  readonly id: string;
  readonly currentTurnUserId: string | null;
  readonly currentTurnDeadline: Date;
}

/**
 * Scan les matches async actifs avec deadline expiree. Limite a 100
 * pour eviter un long cron. L'index `(mode, currentTurnDeadline)` rend
 * cette query O(log n).
 */
export async function findExpiredAsyncMatches(
  now: Date = new Date(),
  limit = 100,
): Promise<ExpiredAsyncMatch[]> {
  const rows = await prisma.match.findMany({
    where: {
      mode: "async",
      status: "active",
      currentTurnDeadline: { lt: now },
    },
    select: {
      id: true,
      currentTurnUserId: true,
      currentTurnDeadline: true,
    },
    take: limit,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows as any[]).map((r) => ({
    id: r.id as string,
    currentTurnUserId: (r.currentTurnUserId as string | null) ?? null,
    currentTurnDeadline: r.currentTurnDeadline as Date,
  }));
}

interface PersistedGameState {
  readonly currentPlayer: "A" | "B";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly [k: string]: any;
}

interface LastTurnPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly gameState?: any;
}

function parseGameState(payload: unknown): PersistedGameState | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as LastTurnPayload;
  let gs = p.gameState;
  if (typeof gs === "string") {
    try {
      gs = JSON.parse(gs);
    } catch {
      return null;
    }
  }
  if (!gs || typeof gs !== "object") return null;
  return gs as PersistedGameState;
}

export interface ForceEndTurnOutcome {
  readonly matchId: string;
  readonly previousPlayer: "A" | "B";
  readonly nextPlayer: "A" | "B" | null;
  readonly nextUserId: string | null;
  readonly newDeadline: Date | null;
  readonly matchEnded: boolean;
}

/**
 * Force un END_TURN sur un match async dont la deadline est depassee.
 *
 * Idempotent : re-verifie `mode === "async"` et `deadline < now()` avant
 * d'agir. Si deja resolu par un autre call, throw `DEADLINE_NOT_EXPIRED`.
 *
 * @throws {AsyncMatchError} MATCH_NOT_FOUND / MATCH_NOT_ASYNC /
 *   MATCH_NOT_ACTIVE / NO_GAMESTATE / DEADLINE_NOT_EXPIRED
 */
export async function forceEndTurnOnDeadline(
  matchId: string,
  now: Date = new Date(),
): Promise<ForceEndTurnOutcome> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { turns: { orderBy: { number: "asc" } } },
  });
  if (!match) {
    throw new AsyncMatchError(
      "MATCH_NOT_FOUND",
      `Match ${matchId} introuvable.`,
    );
  }
  if ((match.mode as string) !== "async") {
    throw new AsyncMatchError(
      "MATCH_NOT_ASYNC",
      "Le match n'est pas en mode async.",
    );
  }
  if ((match.status as string) !== "active") {
    throw new AsyncMatchError(
      "MATCH_NOT_ACTIVE",
      `Match ${matchId} n'est pas actif (status=${match.status}).`,
    );
  }
  const deadline = match.currentTurnDeadline as Date | null;
  if (!deadline || deadline.getTime() > now.getTime()) {
    throw new AsyncMatchError(
      "DEADLINE_NOT_EXPIRED",
      "La deadline du tour n'est pas encore depassee.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turns = (match.turns as any[]) ?? [];
  const lastWithState = [...turns]
    .reverse()
    .find((t) => parseGameState(t.payload) !== null);
  const gameState = lastWithState
    ? parseGameState(lastWithState.payload)
    : null;
  if (!gameState) {
    throw new AsyncMatchError(
      "NO_GAMESTATE",
      "Aucun gameState trouve pour ce match.",
    );
  }

  // RNG deterministe seede par le move count (idem que processMove).
  const moveCount = turns.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => t.payload?.type === "gameplay-move",
  ).length;
  const rng = makeRNG(`${match.seed}-move-${moveCount}-forced`);

  const previousPlayer = gameState.currentPlayer;
  const endTurnMove: Move = { type: "END_TURN" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newState: any;
  try {
    // Le gameState a ete persiste par le engine donc on lui fait confiance.
    // Cast via `as any` pour eviter de copier l'interface GameState complete
    // dans le service (couplage fort).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newState = applyMove(gameState as any, endTurnMove, rng);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "engine-error";
    throw new AsyncMatchError(
      "NO_GAMESTATE",
      `Engine refuse END_TURN forced: ${msg}`,
    );
  }

  const turnNumber = turns.length + 1;
  await prisma.turn.create({
    data: {
      matchId,
      number: turnNumber,
      payload: {
        type: "gameplay-move",
        userId: null,
        move: endTurnMove,
        forced: true,
        forcedReason: "deadline",
        gameState: newState,
        timestamp: now.toISOString(),
      },
    },
  });

  const nextTeamSide: "A" | "B" = newState.currentPlayer;
  const selections = await prisma.teamSelection.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const nextUserId =
    nextTeamSide === "A"
      ? (selections[0]?.userId as string | undefined) ?? null
      : (selections[1]?.userId as string | undefined) ?? null;

  const matchEnded = isMatchEnded(newState);
  const newDeadline = matchEnded
    ? null
    : computeDeadline(now, match.turnDeadlineHours as number);

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(matchEnded ? { status: "ended" } : {}),
      currentTurnUserId: matchEnded ? null : nextUserId,
      lastMoveAt: now,
      currentTurnDeadline: newDeadline,
    },
  });

  return {
    matchId,
    previousPlayer,
    nextPlayer: matchEnded ? null : nextTeamSide,
    nextUserId,
    newDeadline,
    matchEnded,
  };
}

export interface SweepResult {
  readonly inspected: number;
  readonly forced: number;
  readonly failed: number;
}

/**
 * Cron handler : scan + force-end-turn tous les async matches expires.
 * Best-effort par-item (si un match echoue, les autres continuent).
 */
export async function sweepExpiredAsyncMatches(
  now: Date = new Date(),
): Promise<SweepResult> {
  const expired = await findExpiredAsyncMatches(now);
  let forced = 0;
  let failed = 0;
  for (const m of expired) {
    try {
      await forceEndTurnOnDeadline(m.id, now);
      forced += 1;
    } catch (err: unknown) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "unknown";
      serverLog.warn(
        `[async-match] sweep: force-end-turn failed for match=${m.id}: ${msg}`,
      );
    }
  }
  return { inspected: expired.length, forced, failed };
}

export interface AsyncMatchView {
  readonly matchId: string;
  readonly mode: "realtime" | "async";
  readonly status: string;
  readonly currentTurnUserId: string | null;
  readonly currentTurnDeadline: string | null;
  readonly turnDeadlineHours: number;
  readonly hoursRemaining: number | null;
  readonly isYourTurn: boolean;
  readonly isDeadlineExpired: boolean;
}

/**
 * Vue async d'un match pour un user donne : isYourTurn + countdown.
 * Marche aussi pour les realtime matches (retourne hoursRemaining=null).
 */
export async function getAsyncMatchView(
  matchId: string,
  userId: string,
  now: Date = new Date(),
): Promise<AsyncMatchView | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      mode: true,
      status: true,
      currentTurnUserId: true,
      currentTurnDeadline: true,
      turnDeadlineHours: true,
    },
  });
  if (!match) return null;
  const deadline = match.currentTurnDeadline as Date | null;
  const hoursRemaining =
    deadline === null
      ? null
      : Math.max(0, (deadline.getTime() - now.getTime()) / (60 * 60 * 1000));
  return {
    matchId: match.id as string,
    mode: match.mode as "realtime" | "async",
    status: match.status as string,
    currentTurnUserId: (match.currentTurnUserId as string | null) ?? null,
    currentTurnDeadline: deadline ? deadline.toISOString() : null,
    turnDeadlineHours: match.turnDeadlineHours as number,
    hoursRemaining,
    isYourTurn: match.currentTurnUserId === userId,
    isDeadlineExpired:
      deadline !== null && deadline.getTime() <= now.getTime(),
  };
}
