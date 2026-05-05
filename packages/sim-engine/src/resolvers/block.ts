/**
 * Block resolver — sprint Pro League 0.A.5.
 *
 * BB rule (BB2020 / BB3) — sim-engine slice :
 * - Attacker must be standing and adjacent to the defender.
 * - Block dice count : `calculateBlockDiceCount` (1d / 2d / 3d) using
 *   strengths + assists. Higher-ST side picks ; ties picked by attacker.
 * - 6 face values : PLAYER_DOWN / BOTH_DOWN / PUSH_BACK / STUMBLE / POW.
 *   (Faces 4..6 used by BB2020 may map to BOTH_DOWN twice — kept simple
 *   here using a 6-face table that matches the canonical BB die.)
 * - Skill interactions modelled :
 *   - Attacker `block` : turns BOTH_DOWN into "no effect" for him.
 *   - Defender `block` : turns BOTH_DOWN into "no effect" for him.
 *   - Defender `dodge` : turns STUMBLE into PUSH_BACK.
 *   - Attacker `tackle` : suppresses defender's `dodge` for STUMBLE.
 *   - `wrestle` : either side may turn BOTH_DOWN into "both prone, no
 *     turnover" — driver-level decision, modelled here as opt-in via
 *     `BlockInput.useWrestle`.
 * - Turnover trigger : attacker is knocked down (PLAYER_DOWN, or
 *   BOTH_DOWN when attacker has no Block, or STUMBLE without Dodge when
 *   attacker has Tackle and the chosen die is STUMBLE).
 */

import type { MatchEvent } from '@bb/shared-types';
import { calculateBlockDiceCount } from '@bb/game-engine';

import { rollD6 } from '../rng/seeded';

import {
  hasSkill,
  isAdjacent,
  requirePlayer,
  updatePlayer,
  type ResolverPlayer,
  type ResolverResult,
  type ResolverRng,
  type ResolverState,
} from './types';

export type BlockDieFace = 'PLAYER_DOWN' | 'BOTH_DOWN' | 'PUSH_BACK' | 'STUMBLE' | 'POW';

const BLOCK_DIE_FACES: readonly BlockDieFace[] = [
  'PLAYER_DOWN',
  'BOTH_DOWN',
  'PUSH_BACK',
  'PUSH_BACK',
  'STUMBLE',
  'POW',
];

export interface BlockInput {
  attackerId: string;
  defenderId: string;
  displayAtMs: number;
  /** When the attacker has `wrestle`, opt to convert BOTH_DOWN. */
  useWrestle?: boolean;
}

export interface BlockResult extends ResolverResult {
  readonly trace: {
    diceCount: number;
    chooser: 'attacker' | 'defender';
    rolls: readonly BlockDieFace[];
    chosen: BlockDieFace;
    resolution: 'attacker_down' | 'defender_down' | 'both_down' | 'push_only' | 'wrestle';
  };
}

function rollBlockDie(rng: ResolverRng): BlockDieFace {
  return BLOCK_DIE_FACES[rollD6(rng as Parameters<typeof rollD6>[0]) - 1] as BlockDieFace;
}

function pickBlockDie(
  rolls: readonly BlockDieFace[],
  chooser: 'attacker' | 'defender'
): BlockDieFace {
  // Worst face for defender = PLAYER_DOWN > BOTH_DOWN > PUSH > STUMBLE > POW.
  // (Higher rank = better for attacker.)
  const ATTACKER_PREF: Record<BlockDieFace, number> = {
    POW: 5,
    STUMBLE: 4,
    PUSH_BACK: 3,
    BOTH_DOWN: 2,
    PLAYER_DOWN: 1,
  };
  const sorted = [...rolls].sort((a, b) => ATTACKER_PREF[b] - ATTACKER_PREF[a]);
  // Attacker picks best-for-him (max), defender picks worst-for-attacker (min).
  return chooser === 'attacker' ? sorted[0] : sorted[sorted.length - 1];
}

function chooserOf(attacker: ResolverPlayer, defender: ResolverPlayer): 'attacker' | 'defender' {
  // BB rule : higher ST-equivalent (ST + assists) picks. We feed
  // `calculateBlockDiceCount` with raw ST (assists are external in this
  // simplified slice) and rely on the magnitude returned : if dice > 1
  // *because* attacker is stronger, attacker chooses ; if dice > 1 because
  // defender is stronger, defender chooses ; on equality, attacker picks.
  return attacker.st >= defender.st ? 'attacker' : 'defender';
}

export function resolveBlock(
  state: ResolverState,
  input: BlockInput,
  rng: ResolverRng
): BlockResult {
  const attacker = requirePlayer(state, input.attackerId);
  const defender = requirePlayer(state, input.defenderId);

  if (attacker.team === defender.team) {
    throw new Error('resolveBlock: cannot block teammate');
  }
  if (attacker.state !== 'standing') {
    throw new Error('resolveBlock: attacker must be standing');
  }
  if (defender.state !== 'standing') {
    throw new Error('resolveBlock: defender must be standing');
  }
  if (!isAdjacent(attacker.position, defender.position)) {
    throw new Error('resolveBlock: attacker and defender must be adjacent');
  }

  const diceCount = calculateBlockDiceCount(attacker.st, defender.st);
  const chooser = chooserOf(attacker, defender);
  const rolls: BlockDieFace[] = Array.from({ length: diceCount }, () => rollBlockDie(rng));

  let chosen = pickBlockDie(rolls, chooser);

  // STUMBLE → PUSH_BACK if defender has dodge AND attacker lacks tackle.
  if (chosen === 'STUMBLE') {
    if (hasSkill(defender, 'dodge') && !hasSkill(attacker, 'tackle')) {
      chosen = 'PUSH_BACK';
    }
  }

  let attackerDown = false;
  let defenderDown = false;
  let resolution: BlockResult['trace']['resolution'] = 'push_only';

  switch (chosen) {
    case 'POW':
      defenderDown = true;
      resolution = 'defender_down';
      break;
    case 'STUMBLE':
      // Reached only when not converted to PUSH_BACK above.
      defenderDown = true;
      resolution = 'defender_down';
      break;
    case 'PUSH_BACK':
      // Push without knockdown (driver picks the push square).
      resolution = 'push_only';
      break;
    case 'PLAYER_DOWN':
      attackerDown = true;
      resolution = 'attacker_down';
      break;
    case 'BOTH_DOWN': {
      const wrestle = input.useWrestle === true && (hasSkill(attacker, 'wrestle') || hasSkill(defender, 'wrestle'));
      if (wrestle) {
        attackerDown = true;
        defenderDown = true;
        resolution = 'wrestle';
      } else {
        attackerDown = !hasSkill(attacker, 'block');
        defenderDown = !hasSkill(defender, 'block');
        resolution = attackerDown && defenderDown ? 'both_down' : attackerDown ? 'attacker_down' : defenderDown ? 'defender_down' : 'push_only';
      }
      break;
    }
  }

  let newState: ResolverState = state;
  if (attackerDown) {
    newState = updatePlayer(newState, attacker.id, { state: 'prone' });
    if (attacker.hasBall) newState = updatePlayer(newState, attacker.id, { hasBall: false });
  }
  if (defenderDown) {
    newState = updatePlayer(newState, defender.id, { state: 'prone' });
    if (defender.hasBall) newState = updatePlayer(newState, defender.id, { hasBall: false });
  }

  const events: MatchEvent[] = [
    {
      type: 'BLOCK',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: {
        attackerId: attacker.id,
        defenderId: defender.id,
        diceCount,
        chooser,
        rolls,
        chosen,
        resolution,
        useWrestle: input.useWrestle === true,
      },
    },
  ];
  if (attackerDown) {
    events.push({
      type: 'TURNOVER',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: { cause: 'block_attacker_down', attackerId: attacker.id },
    });
  }

  return {
    success: !attackerDown,
    turnover: attackerDown,
    newState,
    events,
    trace: {
      diceCount,
      chooser,
      rolls,
      chosen,
      resolution,
    },
  };
}
