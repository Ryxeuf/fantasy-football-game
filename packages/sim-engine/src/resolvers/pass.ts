/**
 * Pass resolver — sprint Pro League 0.A.5.
 *
 * BB rule (BB2020 / BB3) — short-form rules used by the sim :
 * - Passer must have the ball ; target square is reachable ; range is
 *   determined by `getPassRange` (Quick / Short / Long / Bomb / null).
 * - Target on a d6 = `Math.max(2, Math.min(6, 7 - PA - rangeMod - tzMod))`
 *   where `tzMod = -1` per opposing TZ on the passer (capped per BB rules).
 * - Skill `pass` : reroll a failed pass once per activation.
 * - Skill `accurate` : `+1` to pass roll for short / quick.
 * - Skill `strong_arm` : `+1` to pass roll for long / bomb.
 * - On fail / fumble (1 modified) the team commits a turnover.
 *
 * The catch resolution is deliberately out of scope here ; the driver
 * (0.A.2) chains a separate catch attempt at the destination square once
 * the pass succeeds.
 */

import type { MatchEvent } from '@bb/shared-types';
import { getPassRange } from '@bb/game-engine';

/** BB2020 / BB3 pass range modifier table. Inlined here because the
 *  game-engine helper is not part of the public `@bb/game-engine` index. */
function getPassRangeModifier(range: 'quick' | 'short' | 'long' | 'bomb'): number {
  switch (range) {
    case 'quick':
      return 1;
    case 'short':
      return 0;
    case 'long':
      return -1;
    case 'bomb':
      return -2;
  }
}

import { rollD6 } from '../rng/seeded';

import {
  adjacentOpponents,
  hasSkill,
  requirePlayer,
  updatePlayer,
  type ResolverPosition,
  type ResolverResult,
  type ResolverRng,
  type ResolverState,
} from './types';

export interface PassInput {
  passerId: string;
  to: ResolverPosition;
  displayAtMs: number;
}

export interface PassResult extends ResolverResult {
  readonly trace: {
    range: 'quick' | 'short' | 'long' | 'bomb' | null;
    target: number;
    modifier: number;
    roll: number;
    fumble: boolean;
    rerollRoll?: number;
    usedReroll: boolean;
  };
}

export function resolvePass(
  state: ResolverState,
  input: PassInput,
  rng: ResolverRng
): PassResult {
  const passer = requirePlayer(state, input.passerId);
  if (passer.state !== 'standing') {
    throw new Error('resolvePass: passer must be standing');
  }
  if (!passer.hasBall) {
    throw new Error('resolvePass: passer does not have the ball');
  }

  const range = getPassRange(passer.position, input.to);
  // `null` range means out-of-range : we model it as a fumble-equivalent
  // (the driver should never call us in that case ; defensive guard).
  if (range === null) {
    throw new Error('resolvePass: target out of pass range');
  }

  const rangeMod = getPassRangeModifier(range);
  const tzCount = adjacentOpponents(state, passer.position, passer.team).length;
  const tzMod = -tzCount;
  // Skills
  const accurateMod = hasSkill(passer, 'accurate') && (range === 'quick' || range === 'short') ? 1 : 0;
  // BB2020 Strong Arm : « Add 1 to any Short, Long or Long Bomb passes. »
  // L'ancien code excluait Short, ce qui sous-évaluait les Throwers.
  const strongArmMod =
    hasSkill(passer, 'strong_arm') && (range === 'short' || range === 'long' || range === 'bomb')
      ? 1
      : 0;

  const totalModifier = rangeMod + tzMod + accurateMod + strongArmMod;

  // BB3 target : raw d6 >= 7 - pa - modifier, clamped to [2, 6].
  // BUG fix : utilise PA (Passing Ability) au lieu d'AG. Avant le fix,
  // `passer.ag` etait utilise (workaround « le driver mappe PA→ag »).
  // ResolverPlayer expose maintenant `pa` directement → utilise. Cf.
  // BB3 LRB : PA remplace AG pour les passes.
  const rawTarget = 7 - passer.pa - totalModifier;
  const target = Math.max(2, Math.min(6, rawTarget));

  const firstRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
  // BB rule : a natural 1 is always a fumble (regardless of mods).
  const isFumble = firstRoll === 1;
  let success = !isFumble && firstRoll >= target;
  let usedReroll = false;
  let secondRoll: number | undefined;

  if (!success && hasSkill(passer, 'pass') && passer.rerollAvailable !== false) {
    usedReroll = true;
    secondRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
    const isSecondFumble = secondRoll === 1;
    success = !isSecondFumble && secondRoll >= target;
  }

  let newState: ResolverState = state;
  if (usedReroll) {
    newState = updatePlayer(newState, passer.id, { rerollAvailable: false });
  }

  // Un fumble peut survenir au premier ou au reroll. Dans les deux cas, la
  // balle tombe aux pieds du passer (BB rule) — le scatter est driver-side.
  // Avant ce fix, un reroll-fumble laissait `hasBall` sur le passer alors
  // que `meta.fumble` était `true`, créant un state incohérent.
  const fumbleOccurred = isFumble || (usedReroll && secondRoll === 1);
  if (success) {
    newState = updatePlayer(newState, passer.id, { hasBall: false });
    newState = { ...newState, ballAt: { ...input.to } };
  } else if (fumbleOccurred) {
    newState = updatePlayer(newState, passer.id, { hasBall: false });
  }

  const events: MatchEvent[] = [
    {
      type: 'PASS',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: {
        passerId: passer.id,
        from: passer.position,
        to: input.to,
        range,
        target,
        modifier: totalModifier,
        roll: firstRoll,
        rerollRoll: secondRoll,
        usedReroll,
        fumble: fumbleOccurred,
        success,
      },
    },
  ];
  if (!success) {
    events.push({
      type: 'TURNOVER',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: {
        cause: fumbleOccurred ? 'pass_fumble' : 'pass_failed',
        passerId: passer.id,
      },
    });
  }

  return {
    success,
    turnover: !success,
    newState,
    events,
    trace: {
      range,
      target,
      modifier: totalModifier,
      roll: firstRoll,
      fumble: fumbleOccurred,
      rerollRoll: secondRoll,
      usedReroll,
    },
  };
}
