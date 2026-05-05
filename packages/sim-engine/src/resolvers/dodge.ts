/**
 * Dodge resolver — sprint Pro League 0.A.5.
 *
 * BB rule (BB2020 / BB3) :
 * - When a player leaves an enemy tackle zone, they must roll a dodge
 *   d6 ≥ `7 - AG`, modified by tackle zones in the destination square.
 * - Standard modifiers : `+1` if no opposing TZ on `to`, `-1` per TZ on `to`.
 * - Skill `dodge` : reroll a failed dodge once per activation (consumed by
 *   opposing `tackle` skill).
 * - On fail (after rerolls), the player is knocked down and a turnover
 *   is committed.
 */

import type { MatchEvent } from '@bb/shared-types';

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

export interface DodgeInput {
  playerId: string;
  to: ResolverPosition;
  displayAtMs: number;
}

export interface DodgeResult extends ResolverResult {
  readonly trace: {
    target: number;
    modifier: number;
    roll: number;
    rerollRoll?: number;
    usedReroll: boolean;
  };
}

/**
 * Returns `true` if any standing opposing player adjacent to `player.position`
 * has the `tackle` skill (cancels the Dodge skill reroll for *this* dodge).
 */
function isDodgeRerollSuppressed(
  state: ResolverState,
  player: { position: ResolverPosition; team: 'home' | 'away' }
): boolean {
  const opps = adjacentOpponents(state, player.position, player.team);
  return opps.some((p) => p.skills.includes('tackle'));
}

export function resolveDodge(
  state: ResolverState,
  input: DodgeInput,
  rng: ResolverRng
): DodgeResult {
  const player = requirePlayer(state, input.playerId);
  if (player.state !== 'standing') {
    throw new Error('resolveDodge: only standing players can dodge');
  }

  // Modifier driven by destination TZs (BB2020) ; we treat absence of TZ as
  // `+1` per BB2020 simplification.
  const tzAtDestination = state.players.filter(
    (p) =>
      p.team !== player.team &&
      p.state === 'standing' &&
      Math.max(Math.abs(p.position.x - input.to.x), Math.abs(p.position.y - input.to.y)) === 1 &&
      !(p.position.x === input.to.x && p.position.y === input.to.y)
  ).length;
  const modifier = tzAtDestination === 0 ? 1 : -tzAtDestination;
  const rawTarget = 7 - player.ag - modifier;
  const target = Math.max(2, Math.min(6, rawTarget));

  const firstRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
  let success = firstRoll >= target;
  let usedReroll = false;
  let secondRoll: number | undefined;

  const dodgeRerollEligible =
    hasSkill(player, 'dodge') &&
    !isDodgeRerollSuppressed(state, player) &&
    player.rerollAvailable !== false;

  if (!success && dodgeRerollEligible) {
    usedReroll = true;
    secondRoll = rollD6(rng as Parameters<typeof rollD6>[0]);
    success = secondRoll >= target;
  }

  let newState: ResolverState = state;
  if (usedReroll) {
    newState = updatePlayer(newState, player.id, { rerollAvailable: false });
  }

  if (success) {
    newState = updatePlayer(newState, player.id, { position: { ...input.to } });
    if (player.hasBall) {
      newState = { ...newState, ballAt: { ...input.to } };
    }
  } else {
    newState = updatePlayer(newState, player.id, { state: 'prone' });
    if (player.hasBall) {
      // Ball drops at origin ; scatter handled by driver.
      newState = updatePlayer(newState, player.id, { hasBall: false });
    }
  }

  const events: MatchEvent[] = [
    {
      type: 'DODGE',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: {
        playerId: player.id,
        from: player.position,
        to: input.to,
        target,
        modifier,
        roll: firstRoll,
        rerollRoll: secondRoll,
        usedReroll,
        rerollSuppressedByTackle: !dodgeRerollEligible && hasSkill(player, 'dodge'),
        success,
      },
    },
  ];
  if (!success) {
    events.push({
      type: 'TURNOVER',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: { cause: 'dodge_failed', playerId: player.id },
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
