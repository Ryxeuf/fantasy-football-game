import {
  startPreMatchSequence,
  calculateFanFactor,
  determineWeather,
  addJourneymen,
  makeRNG,
} from "@bb/game-engine";
import type { ExtendedGameState } from "@bb/game-engine";
import { broadcastGameState } from "./game-broadcast";

type PrismaLike = {
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  turn: {
    count: (args: any) => Promise<number>;
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
  teamSelection: {
    findMany: (args: any) => Promise<any[]>;
  };
  match: {
    update: (args: any) => Promise<any>;
  };
};

/**
 * Minimum number of players per team for a Blood Bowl match.
 */
const MIN_PLAYERS_PER_TEAM = 11;

/**
 * Run the automated pre-match sequence phases that require no user input:
 * idle → fans → weather → journeymen → inducements
 *
 * After this, the game state will be in the 'inducements' phase,
 * waiting for both coaches to submit their inducement selections.
 */
export async function runAutomatedPreMatchSequence(
  prisma: PrismaLike,
  matchId: string,
  gameState: ExtendedGameState,
  seed: string,
): Promise<ExtendedGameState> {
  // Only run if the state is at idle phase
  if (gameState.preMatch?.phase !== "idle") {
    return gameState;
  }

  const rng = makeRNG(`${seed}-prematch`);

  // Fetch dedicated fans from team selections
  const teamSelections = await prisma.teamSelection.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    include: { teamRef: { select: { dedicatedFans: true } } },
  });

  const dedicatedFansA = teamSelections[0]?.teamRef?.dedicatedFans ?? 1;
  const dedicatedFansB = teamSelections[1]?.teamRef?.dedicatedFans ?? 1;

  // Phase 1: idle → fans
  let state = startPreMatchSequence(gameState);

  // Phase 2: fans → weather (calculates fan factor with D3 rolls)
  state = calculateFanFactor(state, rng, dedicatedFansA, dedicatedFansB);

  // Phase 3: weather → journeymen (rolls 2D6 for weather)
  state = determineWeather(state, rng);

  // Phase 4: journeymen → inducements
  // Journeymen players are already added at the data level in match-start.ts,
  // so this will add 0 extra players and just transition the phase.
  state = addJourneymen(state, MIN_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM);

  // Persist the state as a turn entry. Wrap in a transaction so we can
  // serialize against `ensureSetupPhasePersisted` and skip the write if the
  // bypass already produced a `setup-init` turn (otherwise we would clobber
  // it with a stale `inducements` state).
  const persisted = await prisma.$transaction(async (tx: any) => {
    if (typeof tx.match?.update === "function") {
      // Re-write status to itself to acquire a row-level lock on the match.
      await tx.match.update({
        where: { id: matchId },
        data: { status: "prematch-setup" },
      });
    }

    const turns = await tx.turn.findMany({
      where: { matchId },
      orderBy: { number: "asc" },
    });
    const hasSetupInit = turns.some(
      (t: any) => t.payload?.type === "setup-init",
    );
    if (hasSetupInit) return false;

    await tx.turn.create({
      data: {
        matchId,
        number: turns.length + 1,
        payload: {
          type: "pre-match-sequence",
          gameState: state,
          timestamp: new Date().toISOString(),
        },
      },
    });
    return true;
  });

  // Broadcast the updated state to all connected clients
  if (persisted) {
    broadcastGameState(matchId, state, { type: "pre-match-sequence" }, "server");
  }

  return state;
}
