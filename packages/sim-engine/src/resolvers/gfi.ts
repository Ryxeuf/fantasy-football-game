/**
 * GFI (Going For It) resolver — sprint Pro League 0.A.5.
 *
 * BB rule (BB2020 / BB3) :
 * - When a player moves past their MA, each extra square requires a GFI
 *   roll on a d6.
 * - Target : 2+ on d6 (3+ in Blizzard / Pouring Rain).
 * - Skill `sure_feet` : reroll a failed GFI once per activation.
 * - On a fail (after rerolls), the player is knocked down → KD →
 *   armour roll → injury roll, and the team commits a turnover.
 *
 * Wire format
 * -----------
 * The 0.A.3 EventType catalogue has no dedicated `GFI` slot ; the driver
 * (0.A.2) surfaces GFI dice as `meta.gfi` on the owning movement event.
 * This resolver therefore returns the dice + outcome in `result.dice` for
 * the driver to weave in, and only emits a `TURNOVER` event when the GFI
 * actually triggers a turnover (so the broadcaster ticker still surfaces
 * the consequence).
 */

import type { MatchEvent } from '@bb/shared-types';

import { rollD6 } from '../rng/seeded';

import {
  hasSkill,
  requirePlayer,
  updatePlayer,
  type ResolverResult,
  type ResolverRng,
  type ResolverState,
} from './types';

export interface GfiInput {
  playerId: string;
  displayAtMs: number;
}

export interface GfiResult extends ResolverResult {
  /** Dice trace for the driver to attach to the owning movement event. */
  readonly trace: {
    target: number;
    roll: number;
    rerollRoll?: number;
    usedReroll: boolean;
  };
}

export function gfiTargetForWeather(weather: ResolverState['weather']): number {
  return weather === 'blizzard' || weather === 'pouring_rain' ? 3 : 2;
}

export function resolveGfi(
  state: ResolverState,
  input: GfiInput,
  rng: ResolverRng
): GfiResult {
  const player = requirePlayer(state, input.playerId);
  if (player.state !== 'standing') {
    throw new Error(`resolveGfi: player '${player.id}' is not standing`);
  }

  const target = gfiTargetForWeather(state.weather);
  const firstRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
  let success = firstRoll >= target;
  let usedReroll = false;
  let secondRoll: number | undefined;

  if (!success && hasSkill(player, 'sure_feet') && player.rerollAvailable !== false) {
    usedReroll = true;
    secondRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
    success = secondRoll >= target;
  }

  let newState: ResolverState = state;
  if (usedReroll) {
    newState = updatePlayer(newState, player.id, { rerollAvailable: false });
  }

  const events: MatchEvent[] = [];
  if (!success) {
    newState = updatePlayer(newState, player.id, { state: 'prone' });
    events.push({
      type: 'TURNOVER',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: {
        cause: 'gfi_failed',
        playerId: player.id,
        target,
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
      roll: firstRoll,
      rerollRoll: secondRoll,
      usedReroll,
    },
  };
}
