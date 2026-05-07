/**
 * S27.8.4 — Helpers d'echec extraits de `actions.ts`.
 *
 * Deux fonctions partagees par les handlers de mouvement / esquive /
 * GFI / pickup / leap pour appliquer les consequences d'un jet rate :
 *
 *  - `applyRollFailure` : chute du joueur (turnover, jet d'armure +
 *    blessure si percee, perte de balle). Optionnellement bonus
 *    d'Arm Bar sur l'armure.
 *  - `applyPickupFailure` : echec du ramassage (turnover + rebond
 *    de la balle).
 *
 * Aucune dependance interne au dispatcher : ces helpers sont des
 * "feuilles" qui n'appellent que des modules `mechanics/*`,
 * `utils/dice-notifications` et `utils/logging`. Les extraire en
 * premier permet aux handlers cycliques (handleLeap / handleNormalMove
 * / handleRerollChoose etc.) d'etre extraits dans des slices suivants
 * sans devoir re-importer ces helpers depuis `actions.ts`.
 */

import type { GameState, RNG } from '../core/types';
import { performArmorRollWithNotification } from '../utils/dice-notifications';
import { performInjuryRoll } from '../mechanics/injury';
import { bounceBall } from '../mechanics/ball';
import { createLogEntry } from '../utils/logging';

/**
 * Applique les consequences d'un echec de jet (chute, turnover,
 * armure, perte de balle).
 *
 * @param armorBonus Bonus optionnel applique au jet d'armure (ex:
 *   +1 d'Arm Bar quand une esquive a echoue dans la zone de tacle
 *   d'un adversaire avec ce skill).
 */
export function applyRollFailure(
  state: GameState,
  playerIndex: number,
  rng: RNG,
  armorBonus = 0,
): GameState {
  const player = state.players[playerIndex];
  state.isTurnover = true;
  state.players[playerIndex] = { ...player, stunned: true };

  // Jet d'armure (avec bonus eventuel d'Arm Bar). `armorBonus` est
  // exprime comme bonus a l'attaquant (i.e. +1 facilite la cassure
  // d'armure). Il est negativise ici car
  // `performArmorRollWithNotification` attend un modificateur a
  // appliquer au TARGET (positif = armure plus difficile a percer).
  const armorResult = performArmorRollWithNotification(
    state.players[playerIndex],
    rng,
    -armorBonus,
  );
  state.lastDiceResult = armorResult;
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${
      armorResult.success ? '✓' : '✗'
    }${armorBonus > 0 ? ` [Arm Bar +${armorBonus}]` : ''}`,
    player.id,
    player.team,
    {
      diceRoll: armorResult.diceRoll,
      targetNumber: armorResult.targetNumber,
      success: armorResult.success,
      armBar: armorBonus > 0,
    },
  );
  state.gameLog = [...state.gameLog, armorLog];

  // Si l'armure est percee (success = false), faire un jet de
  // blessure
  if (!armorResult.success) {
    state = performInjuryRoll(state, state.players[playerIndex], rng);
  }

  // Perte de balle si le joueur la portait
  if (player.hasBall) {
    state.players[playerIndex] = {
      ...state.players[playerIndex],
      hasBall: false,
    };
    state.ball = { ...state.players[playerIndex].pos };
    return bounceBall(state, rng);
  }

  return state;
}

/**
 * Applique les consequences d'un echec de pickup (rebond + turnover).
 */
export function applyPickupFailure(
  state: GameState,
  playerIndex: number,
  rng: RNG,
): GameState {
  state.isTurnover = true;
  const failLog = createLogEntry(
    'turnover',
    `Échec du ramassage - Turnover`,
    state.players[playerIndex].id,
    state.players[playerIndex].team,
  );
  state.gameLog = [...state.gameLog, failLog];
  return bounceBall(state, rng);
}
