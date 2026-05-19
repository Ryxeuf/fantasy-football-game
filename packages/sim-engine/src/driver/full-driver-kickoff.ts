/**
 * Headless kickoff sequence for the full driver.
 *
 * BB 2025 kickoff sequence :
 *   1. Receiving coach places players (already done by formation tables
 *      in `full-driver-roster.ts`).
 *   2. Kicking coach places players (idem).
 *   3. Kicker chooses a target square in the receiving half.
 *   4. Scatter : D8 direction + D6 distance.
 *   5. Kickoff event : roll 2D6 on the kickoff table and apply.
 *   6. Ball lands : pickup roll if a receiver is on it, bounce on fail,
 *      touchback if ball lands out of the receiving half.
 *
 * The full driver runs headless (no UI) so we orchestrate the entire
 * sequence here, picking simple defaults for kicker target (centre of
 * receiving half) and skipping interactive kickoff events that require
 * coach decisions (perfect-defence, high-kick, blitz → no-op for now).
 *
 * The sim-engine MVP keeps the "ball ends up with a receiver" outcome
 * realistic via `resolveKickoffBallLanding` (handles pickup roll + bounce
 * + touchback). The kickoff event roll is logged for narrative purposes
 * but only non-interactive effects (riot, cheering fans, weather change,
 * bribes, etc.) are applied.
 */

import {
  bounceBall,
  resolveKickoffBallLanding,
  rollKickoffEvent,
  applyKickoffEvent,
  createLogEntry,
} from '@bb/game-engine';
import type { GameState, RNG, TeamId, Position } from '@bb/game-engine';

/**
 * Interactive kickoff events that require a coach decision (UI / AI).
 * In the headless sim we skip their resolution but still log the event
 * roll for narrative continuity. The non-interactive ones are applied
 * via `applyKickoffEvent` directly.
 */
const INTERACTIVE_EVENTS = new Set<string>([
  'perfect-defence',
  'high-kick',
  'blitz',
  'quick-snap',
]);

/**
 * Pick the kicker's target square : centre of the receiving half.
 * Receiving team A → kicker B → target in A's half (x in 1..12, mid y).
 * Receiving team B → kicker A → target in B's half (x in 13..24, mid y).
 */
function pickKickerTarget(state: GameState, receivingTeam: TeamId): Position {
  const midY = Math.floor(state.height / 2);
  // Target the deep mid of the receiving half so scatter has room to
  // disperse without going out of bounds in the average case.
  const x = receivingTeam === 'A' ? Math.floor(state.width / 4) : Math.floor((state.width * 3) / 4);
  return { x, y: midY };
}

/**
 * Apply a D6 distance scatter from `from`, stepping the ball by `dx,dy`
 * up to `distance` times. Stops at the first out-of-bounds step so the
 * ball can still trigger a touchback via the receiving-half check.
 */
function applyScatter(
  state: GameState,
  from: Position,
  direction: { x: number; y: number },
  distance: number,
): GameState {
  let pos: Position = { ...from };
  for (let i = 0; i < distance; i += 1) {
    const next: Position = { x: pos.x + direction.x, y: pos.y + direction.y };
    if (
      next.x < 0 ||
      next.x >= state.width ||
      next.y < 0 ||
      next.y >= state.height
    ) {
      // Stop at the last in-bounds position ; `resolveKickoffBallLanding`
      // will translate "outside receiving half" into a touchback.
      pos = next;
      break;
    }
    pos = next;
  }
  return { ...state, ball: pos };
}

/**
 * Execute a complete BB 2025 kickoff sequence on `state`. The state must
 * already have both teams placed on the pitch (formation tables from
 * `full-driver-roster.ts`). The function leaves the ball either in the
 * hands of a receiver, on a free square in the receiving half, or as a
 * touchback handed to a receiver — matching the official rules.
 *
 * Side-effects on log : kickoff target, scatter (direction + distance),
 * kickoff event roll, landing resolution (pickup/bounce/touchback).
 */
export function executeHeadlessKickoff(
  state: GameState,
  kickingTeam: TeamId,
  rng: RNG,
): GameState {
  const receivingTeam: TeamId = kickingTeam === 'A' ? 'B' : 'A';

  // 1. Kicker places the ball : centre of the receiving half.
  const target = pickKickerTarget(state, receivingTeam);
  let next: GameState = {
    ...state,
    ball: { ...target },
    gameLog: [
      ...state.gameLog,
      createLogEntry(
        'info',
        `Kickoff : ${kickingTeam === 'A' ? 'home' : 'away'} engage vers (${target.x}, ${target.y})`,
      ),
    ],
  };

  // 2. Scatter : D8 direction × D6 distance.
  const dir8 = Math.min(8, Math.floor(rng() * 8) + 1);
  const dirVec: Position = (() => {
    switch (dir8) {
      case 1: return { x: 0, y: -1 };
      case 2: return { x: 1, y: -1 };
      case 3: return { x: 1, y: 0 };
      case 4: return { x: 1, y: 1 };
      case 5: return { x: 0, y: 1 };
      case 6: return { x: -1, y: 1 };
      case 7: return { x: -1, y: 0 };
      default: return { x: -1, y: -1 };
    }
  })();
  const distance = Math.floor(rng() * 6) + 1;
  next = applyScatter(next, target, dirVec, distance);
  next = {
    ...next,
    gameLog: [
      ...next.gameLog,
      createLogEntry(
        'info',
        `Déviation : D8=${dir8}, D6=${distance} → ballon vers (${next.ball?.x ?? '?'}, ${next.ball?.y ?? '?'})`,
      ),
    ],
  };

  // 3. Kickoff event 2D6. On applique uniquement les effets
  //    non-interactifs (riot, cheering fans, weather, bribes, etc.).
  //    Les events qui demandent une décision coach (perfect-defence,
  //    high-kick, blitz, quick-snap) sont juste loggés.
  const { total, event } = rollKickoffEvent(rng);
  next = {
    ...next,
    gameLog: [
      ...next.gameLog,
      createLogEntry(
        'info',
        `Table kickoff (${total}) : ${event.nameFr}`,
      ),
    ],
  };
  if (!INTERACTIVE_EVENTS.has(event.id)) {
    next = applyKickoffEvent(next, event, rng, kickingTeam);
  }

  // 4. Landing : pickup roll si un joueur receveur est sur la case,
  //    bounce si échec, touchback si hors moitié.
  next = resolveKickoffBallLanding(next, receivingTeam, rng);

  // 5. Si la balle est restée au sol (pas de joueur sur la case post-
  //    landing, pas de touchback déclenché), on fait un bounce final
  //    pour la dégager d'une éventuelle case bordure.
  if (next.ball && !next.players.some(p => p.hasBall)) {
    // Ne bounce que si le ballon est strictement à l'intérieur — sinon
    // applyTouchback aurait déjà tranché.
    const b = next.ball;
    if (b.x > 0 && b.x < next.width - 1) {
      next = bounceBall(next, rng);
    }
  }

  return next;
}
