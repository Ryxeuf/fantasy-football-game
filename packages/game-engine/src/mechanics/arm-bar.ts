/**
 * Arm Bar (BB2020 / BB3 Season 2-3)
 *
 * "If an opposing player Falls Over as a result of failing an Agility test
 *  when attempting to perform a Dodge, Jump or Leap action to leave a square
 *  in which they were Marked by this player, you may apply a +1 modifier to
 *  either the Armour roll or the Injury roll."
 *
 * Implementation :
 * - `getArmBarBonus(state, dodger, fromPos)` retourne +1 si au moins un
 *   adversaire adjacent a la case d'origine (au moment ou le joueur a tente
 *   d'esquiver) possede le skill `arm-bar`. Cette valeur est ensuite passee
 *   au jet d'armure consecutif a l'echec de l'esquive (cf. actions.ts).
 * - Sinon retourne 0.
 * - Le bonus n'est jamais cumulatif au-dela de +1 (regle BB) : une seule
 *   instance d'Arm Bar suffit a declencher l'effet.
 */

import { Player, Position, GameState } from '../core/types';
import { isAdjacent } from './movement';
import { hasSkill } from '../skills/skill-effects';

/**
 * Calcule le bonus d'Arm Bar applicable au jet d'armure d'un joueur qui
 * vient d'echouer une esquive depuis `fromPos`. Le bonus est de +1 si au
 * moins un adversaire adjacent a `fromPos` possede `arm-bar`, sinon 0.
 */
export function getArmBarBonus(
  state: GameState,
  dodger: Player,
  fromPos: Position,
): number {
  const opponentTeam = dodger.team === 'A' ? 'B' : 'A';
  const hasArmBarMarker = state.players.some(p => {
    if (p.team !== opponentTeam) return false;
    if (p.stunned) return false;
    if (p.state === 'stunned' || p.state === 'knocked_out' || p.state === 'casualty' || p.state === 'sent_off') return false;
    if (!isAdjacent(p.pos, fromPos)) return false;
    return hasSkill(p, 'arm-bar') || hasSkill(p, 'arm_bar');
  });
  return hasArmBarMarker ? 1 : 0;
}
