import {
  enterSetupPhase,
  addJourneymen,
  type ExtendedGameState,
} from "@bb/game-engine";
import { getLinemanStats } from "./journeymen";

type PrismaLike = {
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  match: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  teamSelection: { findMany: (args: any) => Promise<any[]> };
  turn: { create: (args: any) => Promise<any> };
  roster: { findFirst: (args: any) => Promise<any> };
};

export interface EnsureSetupResult {
  gameState: ExtendedGameState;
  /** True if a new turn was persisted on this call. */
  persisted: boolean;
}

/**
 * Pre-match phases handled by this bypass. Any of these can be transitioned
 * directly to `setup` once the coin-toss is done. The bypass exists because
 * `addJourneymen + enterSetupPhase` were historically run on every `GET /state`
 * call without persistence — this service makes that transition idempotent
 * and atomic across concurrent callers.
 */
const BYPASSABLE_PRE_MATCH_PHASES = new Set([
  "idle",
  "fans",
  "weather",
  "journeymen",
  "inducements",
  "prayers",
  "kicking-team",
]);

const SETUP_INIT_TURN_TYPE = "setup-init";

/**
 * Idempotently ensures the pre-match transition into the `setup` phase is
 * persisted as a turn.
 *
 * If the latest gameState turn is at any pre-setup phase (idle / fans /
 * weather / journeymen / inducements / prayers / kicking-team) and the
 * coin-toss has happened, runs `addJourneymen` (when starting from idle)
 * and `enterSetupPhase` with `receivingTeam` derived from the coin-toss,
 * then persists the result as a `setup-init` turn.
 *
 * Idempotent: a `setup-init` turn is only created at most once per match.
 * Subsequent calls return the existing setup state with `persisted: false`.
 *
 * Concurrency: the entire read-modify-write is wrapped in a Prisma
 * transaction. We re-write `match.status` to itself first to acquire a
 * row-level lock on the match in PostgreSQL (and SQLite serializes the
 * whole transaction), so two concurrent callers won't both create a
 * `setup-init` turn.
 *
 * Returns `null` if the match doesn't exist, isn't in `prematch-setup`/
 * `active`, or has no gameState yet.
 */
export async function ensureSetupPhasePersisted(
  matchId: string,
  prismaClient: PrismaLike,
): Promise<EnsureSetupResult | null> {
  return await prismaClient.$transaction(async (tx: any) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: "asc" } } },
    });
    if (!match) return null;
    if (match.status !== "prematch-setup" && match.status !== "active") {
      return null;
    }

    const latestStateTurn = [...match.turns]
      .reverse()
      .find((t: any) => t.payload?.gameState);
    if (!latestStateTurn) return null;

    let gameState = latestStateTurn.payload.gameState as ExtendedGameState;
    if (typeof gameState === "string") {
      gameState = JSON.parse(gameState as unknown as string);
    }

    // If a setup-init turn was already created we're done — nothing to do
    // even if a later turn (e.g. a stale pre-match-sequence write) brought
    // the visible phase back to inducements. The setup-init turn carries
    // the canonical post-bypass state.
    const setupInitTurn = match.turns.find(
      (t: any) => t.payload?.type === SETUP_INIT_TURN_TYPE,
    );
    if (setupInitTurn) {
      let setupState = setupInitTurn.payload.gameState as ExtendedGameState;
      if (typeof setupState === "string") {
        setupState = JSON.parse(setupState as unknown as string);
      }
      // If the latest gameState is already past setup (e.g. validate-setup
      // moved us forward), prefer that. Otherwise return the setup-init.
      const currentPhase = gameState.preMatch?.phase;
      const useLatest = currentPhase === "setup" || currentPhase === "kickoff" ||
        currentPhase === "kickoff-sequence";
      return {
        gameState: useLatest ? gameState : setupState,
        persisted: false,
      };
    }

    if (!BYPASSABLE_PRE_MATCH_PHASES.has(gameState.preMatch?.phase ?? "")) {
      return { gameState, persisted: false };
    }

    const coinToss = match.turns.find(
      (t: any) => t.payload?.type === "coin-toss",
    );
    if (!coinToss) {
      return { gameState, persisted: false };
    }

    const selections = await tx.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      include: { teamRef: { select: { roster: true } } },
    });
    if (selections.length < 2) {
      return { gameState, persisted: false };
    }

    const [s1, s2] = selections;
    const receivingTeam: "A" | "B" =
      coinToss.payload.receivingUserId === s1.userId ? "A" : "B";

    // Acquire row-level lock on the match record by re-writing its current
    // status to itself. In PostgreSQL this serializes concurrent transactions
    // on the same matchId; SQLite already serializes the whole transaction.
    // After this point only one caller can proceed to create a new turn.
    await tx.match.update({
      where: { id: matchId },
      data: { status: match.status },
    });

    // Re-read turns inside the lock: another transaction may have just
    // persisted a setup-init.
    const refreshed = await tx.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: "asc" } } },
    });
    if (!refreshed) return null;

    const refreshedSetupInit = refreshed.turns.find(
      (t: any) => t.payload?.type === SETUP_INIT_TURN_TYPE,
    );
    if (refreshedSetupInit) {
      let setupState =
        refreshedSetupInit.payload.gameState as ExtendedGameState;
      if (typeof setupState === "string") {
        setupState = JSON.parse(setupState as unknown as string);
      }
      return { gameState: setupState, persisted: false };
    }

    const refreshedLatest = [...refreshed.turns]
      .reverse()
      .find((t: any) => t.payload?.gameState);
    let nextState =
      (refreshedLatest?.payload?.gameState as ExtendedGameState | undefined) ??
      gameState;
    if (typeof nextState === "string") {
      nextState = JSON.parse(nextState as unknown as string);
    }

    const rosterA = (s1 as any)?.teamRef?.roster;
    const rosterB = (s2 as any)?.teamRef?.roster;
    // Only inject journeymen if we're starting from idle: later phases have
    // already had `addJourneymen` applied by the pre-match automation.
    if (rosterA && rosterB && nextState.preMatch?.phase === "idle") {
      const [linemanStatsA, linemanStatsB] = await Promise.all([
        getLinemanStats(tx as any, rosterA),
        getLinemanStats(tx as any, rosterB),
      ]);
      // addJourneymen requires phase 'journeymen'; we toggle around it.
      nextState = {
        ...nextState,
        preMatch: { ...nextState.preMatch, phase: "journeymen" },
      };
      nextState = addJourneymen(
        nextState,
        11,
        11,
        linemanStatsA,
        linemanStatsB,
      );
    }

    // enterSetupPhase only accepts 'idle' or 'setup'. Force the phase to
    // 'idle' before calling so we can transition from any pre-setup phase.
    nextState = {
      ...nextState,
      preMatch: { ...nextState.preMatch, phase: "idle" },
    };
    nextState = enterSetupPhase(nextState, receivingTeam);

    const turnNumber = refreshed.turns.length + 1;
    await tx.turn.create({
      data: {
        matchId,
        number: turnNumber,
        payload: {
          type: SETUP_INIT_TURN_TYPE,
          gameState: nextState,
          receivingTeam,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return { gameState: nextState, persisted: true };
  });
}
