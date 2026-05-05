/**
 * Pickup resolver — sprint Pro League 0.A.5.
 *
 * BB rule (BB2020 / BB3) :
 * - To pick the ball up the player must occupy the ball's square.
 * - Roll d6, target = `7 - AG`, modifier `-1` per opposing tackle zone.
 * - Skill `sure_hands` : reroll a failed pickup once per activation, and
 *   immune to Strip Ball.
 * - Skill `extra_arms` : `+1` to pickup roll.
 * - Weather `pouring_rain` : `-1` to pickup roll (BB2020).
 * - On fail (after rerolls) the ball scatters and a turnover is committed.
 */

import type { MatchEvent } from '@bb/shared-types';

import { rollD6 } from '../rng/seeded';

import {
  adjacentOpponents,
  hasSkill,
  requirePlayer,
  updatePlayer,
  type ResolverPlayer,
  type ResolverResult,
  type ResolverRng,
  type ResolverState,
} from './types';

export interface PickupInput {
  playerId: string;
  displayAtMs: number;
}

export interface PickupResult extends ResolverResult {
  readonly trace: {
    target: number;
    modifier: number;
    roll: number;
    rerollRoll?: number;
    usedReroll: boolean;
  };
}

export function calculatePickupModifier(
  state: ResolverState,
  player: Pick<ResolverPlayer, 'position' | 'team' | 'skills'>
): number {
  const tzPenalty = -adjacentOpponents(state, player.position, player.team).length;
  const weatherPenalty = state.weather === 'pouring_rain' ? -1 : 0;
  const extraArms = player.skills.includes('extra_arms') ? 1 : 0;
  return tzPenalty + weatherPenalty + extraArms;
}

export function resolvePickup(
  state: ResolverState,
  input: PickupInput,
  rng: ResolverRng
): PickupResult {
  const player = requirePlayer(state, input.playerId);
  if (!state.ballAt) {
    throw new Error('resolvePickup: state has no ball position');
  }
  if (state.ballAt.x !== player.position.x || state.ballAt.y !== player.position.y) {
    throw new Error('resolvePickup: player is not standing on the ball');
  }

  // BB target on a d6 : `agility + modifier >= 4` (BB3) is equivalent to
  // `roll + modifier >= 7 - ag`, i.e. raw d6 target is `Math.max(2, Math.min(6, 7 - ag - modifier))`.
  const modifier = calculatePickupModifier(state, player);
  const rawTarget = 7 - player.ag - modifier;
  const target = Math.max(2, Math.min(6, rawTarget));

  const firstRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
  let success = firstRoll >= target;
  let usedReroll = false;
  let secondRoll: number | undefined;

  if (!success && hasSkill(player, 'sure_hands') && player.rerollAvailable !== false) {
    usedReroll = true;
    secondRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
    success = secondRoll >= target;
  }

  let newState: ResolverState = state;
  if (usedReroll) {
    newState = updatePlayer(newState, player.id, { rerollAvailable: false });
  }

  const events: MatchEvent[] = [];

  if (success) {
    newState = updatePlayer(newState, player.id, { hasBall: true });
    newState = { ...newState, ballAt: { ...player.position } };
  } else {
    // Ball stays on the ground in the same square ; scatter is a driver
    // concern (it depends on the kickoff/template). The turnover ends the
    // active team's turn.
    newState = updatePlayer(newState, player.id, { hasBall: false });
    events.push({
      type: 'TURNOVER',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: {
        cause: 'pickup_failed',
        playerId: player.id,
        target,
        modifier,
        roll: firstRoll,
        rerollRoll: secondRoll,
      },
    });
  }

  return {
    success,
    turnover: !success,
    newState,
    events,
    trace: {
      target,
      modifier,
      roll: firstRoll,
      rerollRoll: secondRoll,
      usedReroll,
    },
  };
}
