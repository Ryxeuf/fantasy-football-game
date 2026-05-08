/**
 * S27.8.14 — Module dedie a `handleRerollChoose`, le plus gros handler
 * de `choice-handlers.ts` (~199 lignes incluant les helpers privesS).
 * Extrait pour ramener `choice-handlers.ts` sous la cible secondaire
 * DoD `<= 400 lignes`.
 *
 * Le flux complet est preserve :
 *  1. Si `useReroll === false` : appliquer l'echec original
 *     (`applyRollFailure` ou `applyPickupFailure`).
 *  2. Sinon, test Solitaire (Loner) si applicable : si rate, la
 *     relance est consommee mais l'echec original s'applique.
 *  3. Si autorise (avec ou sans Loner reussi), consommer la relance
 *     et rejouer le jet (dodge / GFI / pickup).
 *
 * Aucune dependance vers `actions.ts` ni vers `choice-handlers.ts` :
 * tous les helpers proviennent de `mechanics/*`, `core/*`, `utils/*`,
 * `skills/*`, `actions/failure-helpers`, `actions/ball-pickup`.
 */

import type {
  GameState,
  Player,
  RNG,
  TeamId,
} from '../core/types';
import { getArmBarBonus } from '../mechanics/arm-bar';
import {
  isInOpponentEndzone,
  awardTouchdown,
} from '../mechanics/ball';
import { samePos } from '../mechanics/movement';
import { hasSkill } from '../skills/skill-effects';
import {
  performDodgeRollWithNotification,
  performPickupRollWithNotification,
} from '../utils/dice-notifications';
import { createLogEntry } from '../utils/logging';
import { applyRollFailure, applyPickupFailure } from './failure-helpers';
import { handleBallPickup } from './ball-pickup';

/**
 * Retourne le seuil Loner du joueur (3, 4 ou 5) ou `null` s'il n'a
 * pas Loner.
 */
function getLonerThreshold(player: Player): number | null {
  if (hasSkill(player, 'loner-3')) return 3;
  if (hasSkill(player, 'loner-4')) return 4;
  if (hasSkill(player, 'loner-5')) return 5;
  return null;
}

/**
 * Consomme une relance d'equipe et marque le flag `rerollUsedThisTurn`.
 */
function consumeTeamReroll(state: GameState, team: TeamId): GameState {
  const newRerolls = { ...state.teamRerolls };
  if (team === 'A') {
    newRerolls.teamA = Math.max(0, (newRerolls.teamA ?? 0) - 1);
  } else {
    newRerolls.teamB = Math.max(0, (newRerolls.teamB ?? 0) - 1);
  }
  return { ...state, teamRerolls: newRerolls, rerollUsedThisTurn: true };
}

/**
 * Gere la decision sur l'utilisation d'une relance d'equipe pour un
 * jet rate (dodge / GFI / pickup), avec test Solitaire (Loner) le cas
 * echeant. Si le test Loner echoue, la relance est consommee mais
 * l'echec original s'applique.
 */
export function handleRerollChoose(
  state: GameState,
  move: { type: 'REROLL_CHOOSE'; useReroll: boolean },
  rng: RNG,
): GameState {
  if (!state.pendingReroll) return state;

  const {
    rollType,
    playerId,
    team,
    modifiers,
    playerIndex,
    from,
    to,
  } = state.pendingReroll;
  let newState: GameState = { ...state, pendingReroll: undefined };

  if (!move.useReroll) {
    // Relance refusee : appliquer les consequences de l'echec
    const declineLog = createLogEntry(
      'action',
      `Relance refusée`,
      playerId,
      team,
    );
    newState.gameLog = [...newState.gameLog, declineLog];

    if (rollType === 'pickup') {
      return applyPickupFailure(newState, playerIndex, rng);
    } else {
      // dodge ou gfi : chute + turnover
      return applyRollFailure(newState, playerIndex, rng);
    }
  }

  // Verification Loner : le joueur doit reussir un jet D6 >= seuil
  const lonerPlayer = newState.players[playerIndex];
  const lonerThreshold = getLonerThreshold(lonerPlayer);
  if (lonerThreshold !== null) {
    const lonerRoll = Math.floor(rng() * 6) + 1;
    const lonerSuccess = lonerRoll >= lonerThreshold;
    const lonerLog = createLogEntry(
      'dice',
      `Solitaire (${lonerThreshold}+) : ${lonerRoll}/${lonerThreshold} ${
        lonerSuccess ? '✓' : '✗'
      }`,
      playerId,
      team,
      {
        diceRoll: lonerRoll,
        targetNumber: lonerThreshold,
        success: lonerSuccess,
      },
    );
    newState.gameLog = [...newState.gameLog, lonerLog];

    if (!lonerSuccess) {
      // Loner check failed: team reroll is consumed (wasted), original
      // failure applies
      newState = consumeTeamReroll(newState, team);
      const wastedLog = createLogEntry(
        'action',
        `Relance d'équipe gaspillée (Solitaire raté)`,
        playerId,
        team,
      );
      newState.gameLog = [...newState.gameLog, wastedLog];

      if (rollType === 'pickup') {
        return applyPickupFailure(newState, playerIndex, rng);
      } else {
        return applyRollFailure(newState, playerIndex, rng);
      }
    }
  }

  // Relance acceptee : consommer la relance
  newState = consumeTeamReroll(newState, team);
  const rerollLog = createLogEntry(
    'action',
    `Relance d'équipe utilisée !`,
    playerId,
    team,
  );
  newState.gameLog = [...newState.gameLog, rerollLog];

  if (rollType === 'dodge') {
    // Relancer le jet d'esquive
    const dodgeResult = performDodgeRollWithNotification(
      newState.players[playerIndex],
      rng,
      modifiers,
    );
    newState.lastDiceResult = dodgeResult;
    const logEntry = createLogEntry(
      'dice',
      `Relance esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${
        dodgeResult.success ? '✓' : '✗'
      }`,
      playerId,
      team,
      {
        diceRoll: dodgeResult.diceRoll,
        targetNumber: dodgeResult.targetNumber,
        success: dodgeResult.success,
      },
    );
    newState.gameLog = [...newState.gameLog, logEntry];

    if (dodgeResult.success) {
      // Touchdown check
      const mover = newState.players[playerIndex];
      if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
        return awardTouchdown(newState, mover.team, mover);
      }
      return newState;
    } else {
      // Echec apres team reroll : appliquer l'echec avec bonus Arm Bar.
      const dodger = newState.players[playerIndex];
      const armBarBonus = from ? getArmBarBonus(newState, dodger, from) : 0;
      return applyRollFailure(newState, playerIndex, rng, armBarBonus);
    }
  } else if (rollType === 'gfi') {
    // Relancer le jet de GFI
    const gfiRoll = Math.floor(rng() * 6) + 1;
    const gfiSuccess = gfiRoll >= 2;
    const logEntry = createLogEntry(
      'dice',
      `Relance GFI: ${gfiRoll}/2 ${gfiSuccess ? '✓' : '✗'}`,
      playerId,
      team,
      { diceRoll: gfiRoll, targetNumber: 2, success: gfiSuccess },
    );
    newState.gameLog = [...newState.gameLog, logEntry];

    if (gfiSuccess) {
      // Touchdown check
      const mover = newState.players[playerIndex];
      if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
        return awardTouchdown(newState, mover.team, mover);
      }
      // Ball pickup check
      if (newState.ball && to && samePos(newState.ball, to)) {
        return handleBallPickup(newState, mover, rng, playerIndex);
      }
      return newState;
    } else {
      return applyRollFailure(newState, playerIndex, rng);
    }
  } else if (rollType === 'pickup') {
    // Relancer le jet de pickup
    const pickupResult = performPickupRollWithNotification(
      newState.players[playerIndex],
      rng,
      modifiers,
    );
    newState.lastDiceResult = pickupResult;
    const logEntry = createLogEntry(
      'dice',
      `Relance pickup: ${pickupResult.diceRoll}/${pickupResult.targetNumber} ${
        pickupResult.success ? '✓' : '✗'
      }`,
      playerId,
      team,
      {
        diceRoll: pickupResult.diceRoll,
        targetNumber: pickupResult.targetNumber,
        success: pickupResult.success,
      },
    );
    newState.gameLog = [...newState.gameLog, logEntry];

    if (pickupResult.success) {
      newState.ball = undefined;
      newState.players[playerIndex] = {
        ...newState.players[playerIndex],
        hasBall: true,
      };
      const successLog = createLogEntry(
        'action',
        `Ballon ramassé avec succès (relance)`,
        playerId,
        team,
      );
      newState.gameLog = [...newState.gameLog, successLog];
      // Touchdown check
      const picker = newState.players[playerIndex];
      if (isInOpponentEndzone(newState, picker)) {
        return awardTouchdown(newState, picker.team, picker);
      }
      return newState;
    } else {
      return applyPickupFailure(newState, playerIndex, rng);
    }
  }

  return newState;
}
