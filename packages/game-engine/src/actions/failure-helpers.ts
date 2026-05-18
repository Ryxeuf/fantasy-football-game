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
 * BUG fix immutabilite : avant, le code mutait directement
 * `state.players[playerIndex] = ...` (ecriture sur l'array partage avec
 * le caller). `reroll-choose-handler.ts:87` passe un shallow clone
 * `{...state, pendingReroll: undefined}` → `newState.players` est la
 * MEME ref que `state.players` du dispatcher → corruption cross-state.
 * Maintenant chaque mutation passe par un spread immutable.
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

  // Immutable : marque le joueur comme tombe + turnover.
  let newState: GameState = {
    ...state,
    isTurnover: true,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, stunned: true } : p,
    ),
  };

  // Jet d'armure (avec bonus eventuel d'Arm Bar).
  const armorResult = performArmorRollWithNotification(
    newState.players[playerIndex],
    rng,
    -armorBonus,
  );
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
  newState = {
    ...newState,
    lastDiceResult: armorResult,
    gameLog: [...newState.gameLog, armorLog],
  };

  // Si l'armure est percee, faire un jet de blessure.
  if (!armorResult.success) {
    newState = performInjuryRoll(newState, newState.players[playerIndex], rng);
  }

  // Perte de balle si le joueur la portait.
  if (player.hasBall) {
    const fallenPlayer = newState.players[playerIndex];
    newState = {
      ...newState,
      ball: { ...fallenPlayer.pos },
      players: newState.players.map((p, i) =>
        i === playerIndex ? { ...p, hasBall: false } : p,
      ),
    };
    return bounceBall(newState, rng);
  }

  return newState;
}

/**
 * Applique les consequences d'un echec de pickup (rebond + turnover).
 *
 * BUG fix immutabilite : avant, `state.isTurnover = true` et
 * `state.gameLog = [...]` mutaient le parametre. Maintenant spread.
 */
export function applyPickupFailure(
  state: GameState,
  playerIndex: number,
  rng: RNG,
): GameState {
  const failLog = createLogEntry(
    'turnover',
    `Échec du ramassage - Turnover`,
    state.players[playerIndex].id,
    state.players[playerIndex].team,
  );
  const newState: GameState = {
    ...state,
    isTurnover: true,
    gameLog: [...state.gameLog, failLog],
  };
  return bounceBall(newState, rng);
}
