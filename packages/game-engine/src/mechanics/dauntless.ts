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
  // BB2020 LRB Dauntless : « Roll a D6 and add the ST value of this player
  // (on his Card). If the result is equal to or greater than the ST value
  // of the Target (on his Card)... » → la cible **base ST** est testee,
  // pas le total ST+assists. Avant le fix, on comparait au total avec
  // assists defensives, ce qui rendait Dauntless plus difficile face a
  // une cible avec assists et donc moins effectif que prevu BB2020.
  // Skill absent or attacker is not underdog → no Dauntless roll.
  if (!hasSkill(attacker, 'dauntless') || attackerStrength >= defenderStrength) {
    return {
      triggered: false,
      newAttackerStrength: attackerStrength,
      newState: state,
    };
  }

  const diceRoll = Math.floor(rng() * 6) + 1;
  // BB2020 : compare au ST de base de la cible, pas au total avec assists.
  const success = attacker.st + diceRoll >= defender.st;

  const rollLog = createLogEntry(
    'dice',
    `Intrépide (${attacker.name}): D6=${diceRoll}+ST${attacker.st}=${
      attacker.st + diceRoll
    } vs ST cible ${defender.st} ${success ? '✓' : '✗'}`,
    attacker.id,
    attacker.team,
    {
      diceRoll,
      targetNumber: defender.st - attacker.st,
      attackerSt: attacker.st,
      defenderBaseSt: defender.st,
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
    // BB2020 : si Dauntless reussit, l'attaquant est considere ST = target's
    // base ST pour ce bloc. Les assists offensives s'ajoutent ensuite. Donc
    // newAttackerStrength = defender.st + (attackerStrength - attacker.st) =
    // defender.st + offensiveAssists.
    newAttackerStrength: success
      ? defender.st + (attackerStrength - attacker.st)
      : attackerStrength,
    newState,
  };
}
