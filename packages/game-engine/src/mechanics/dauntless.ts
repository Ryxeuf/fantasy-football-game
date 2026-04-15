/**
 * Dauntless (BB3 Season 2/3 rules).
 *
 * Before block dice are rolled, if the attacker's total strength (ST + offensive
 * assists) is less than the target's total strength (ST + defensive assists),
 * a Dauntless attacker rolls a D6 and adds their base ST. If the result is
 * greater than or equal to the target's total strength, the attacker's total
 * strength is considered equal to the target's for this block (single-die block,
 * attacker chooses).
 *
 * The Dauntless roll only triggers when the attacker is underdog. It has no
 * effect when strengths are already equal or when the attacker is stronger.
 */

import type { GameState, Player, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { createLogEntry } from '../utils/logging';

export interface DauntlessCheckResult {
  /** Whether the Dauntless roll was actually triggered. */
  triggered: boolean;
  /** Whether the roll succeeded (only defined when triggered). */
  success?: boolean;
  /** The raw D6 roll (only defined when triggered). */
  diceRoll?: number;
  /** Attacker total strength after Dauntless is applied. */
  newAttackerStrength: number;
  /** GameState, possibly with an appended log entry. */
  newState: GameState;
}

/**
 * Check Dauntless for a block action. Does not mutate inputs.
 *
 * @param state - Current game state
 * @param attacker - Player initiating the block
 * @param defender - Target of the block
 * @param attackerStrength - Attacker total strength (ST + offensive assists)
 * @param defenderStrength - Defender total strength (ST + defensive assists)
 * @param rng - Seeded RNG (used only when the skill triggers)
 */
export function checkDauntless(
  state: GameState,
  attacker: Player,
  defender: Player,
  attackerStrength: number,
  defenderStrength: number,
  rng: RNG
): DauntlessCheckResult {
  // Skill absent or attacker is not underdog → no Dauntless roll.
  if (!hasSkill(attacker, 'dauntless') || attackerStrength >= defenderStrength) {
    return {
      triggered: false,
      newAttackerStrength: attackerStrength,
      newState: state,
    };
  }

  const diceRoll = Math.floor(rng() * 6) + 1;
  const success = attacker.st + diceRoll >= defenderStrength;

  const rollLog = createLogEntry(
    'dice',
    `Intrépide (${attacker.name}): D6=${diceRoll}+ST${attacker.st}=${
      attacker.st + diceRoll
    } vs ${defenderStrength} ${success ? '✓' : '✗'}`,
    attacker.id,
    attacker.team,
    {
      diceRoll,
      targetNumber: defenderStrength - attacker.st,
      attackerSt: attacker.st,
      defenderStrength,
      success,
      skill: 'dauntless',
    }
  );

  const newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, rollLog],
  };

  return {
    triggered: true,
    success,
    diceRoll,
    newAttackerStrength: success ? defenderStrength : attackerStrength,
    newState,
  };
}
