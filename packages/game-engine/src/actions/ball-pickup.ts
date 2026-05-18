/**
 * S27.8.5 — Handler de ramassage de balle extrait de `actions.ts`.
 *
 * `handleBallPickup` est appele par plusieurs handlers du dispatcher
 * (handleNormalMove, handleDodgeRoll, handleLeap, handleRerollChoose
 * via la branche pickup). En l'extrayant ici comme feuille (sans
 * dependance interne a `actions.ts`), on permet aux handlers
 * cycliques de l'importer librement dans des slices ulterieurs.
 *
 * Aucune logique modifiee : la fonction est copiee a l'identique.
 */

import type { GameState, Player, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import {
  isInOpponentEndzone,
  awardTouchdown,
  bounceBall,
} from '../mechanics/ball';
import { calculatePickupModifiers } from '../mechanics/movement';
import {
  getPickupSkillModifiers,
  canSkillReroll,
} from '../skills/skill-bridge';
import { performPickupRollWithNotification } from '../utils/dice-notifications';
import { createLogEntry } from '../utils/logging';
import { canUseTeamReroll } from '../core/game-state';

/**
 * Gere le ramassage de balle d'un joueur. Couvre :
 *  - skill `no-hands` (interdit le pickup, turnover immediat).
 *  - jet de pickup avec modifiers (zones de tacle adverses + skills
 *    de pickup type Big Hand / Extra Arms).
 *  - relance auto via `Sure Hands` (registry).
 *  - succes -> attache la balle, touchdown si en-but adverse.
 *  - echec -> propose relance d'equipe si dispo, sinon turnover +
 *    rebond.
 */
/**
 * BUG fix immutabilite : avant, `handleBallPickup` mutait directement
 * le parametre `state` (state.gameLog = ..., state.players[idx].hasBall
 * = true, state.ball = undefined, state.pendingReroll = ...). Certains
 * callers (`reroll-choose-handler.ts:215`) passent un shallow clone
 * `{...state, pendingReroll: undefined}`, donc `state.players` est la
 * MEME reference que celle du caller original — la mutation
 * `state.players[idx].hasBall = true` corrompait le state d'origine.
 * Maintenant chaque mutation passe par un spread immutable.
 */
export function handleBallPickup(
  state: GameState,
  player: Player,
  rng: RNG,
  idx: number,
): GameState {
  // No Hands: player cannot pick up the ball at all (no roll)
  if (hasSkill(player, 'no-hands')) {
    const noHandsLog = createLogEntry(
      'info',
      `Sans Ballon: ${player.name} ne peut pas ramasser le ballon !`,
      player.id,
      player.team,
      { skill: 'no-hands' },
    );
    const turnoverLog = createLogEntry(
      'turnover',
      `Échec du ramassage (Sans Ballon) - Turnover`,
      player.id,
      player.team,
    );
    const newState: GameState = {
      ...state,
      isTurnover: true,
      gameLog: [...state.gameLog, noHandsLog, turnoverLog],
    };
    return bounceBall(newState, rng);
  }

  // Calculer les modificateurs de pickup (malus pour adversaires +
  // bonus skills)
  const basePickupModifiers = calculatePickupModifiers(
    state,
    state.ball!,
    player.team,
  );
  const skillPickupModifiers = getPickupSkillModifiers(state, player);
  const pickupModifiers = basePickupModifiers + skillPickupModifiers;

  // Effectuer le jet de pickup
  let pickupResult = performPickupRollWithNotification(
    player,
    rng,
    pickupModifiers,
  );

  // Tracker les logs et state via accumulateur immutable.
  let newState: GameState = state;

  // Sure Hands : relance automatique du pickup rate (via skill registry)
  if (!pickupResult.success && canSkillReroll(player, 'on-pickup', state)) {
    const rerollLog = createLogEntry(
      'dice',
      `Sure Hands : relance du ramassage (${pickupResult.diceRoll} raté)`,
      player.id,
      player.team,
    );
    newState = { ...newState, gameLog: [...newState.gameLog, rerollLog] };
    pickupResult = performPickupRollWithNotification(
      player,
      rng,
      pickupModifiers,
    );
  }

  // Log du jet de pickup
  const pickupLogEntry = createLogEntry(
    'dice',
    `Jet de pickup: ${pickupResult.diceRoll}/${pickupResult.targetNumber} ${
      pickupResult.success ? '✓' : '✗'
    }`,
    player.id,
    player.team,
    {
      diceRoll: pickupResult.diceRoll,
      targetNumber: pickupResult.targetNumber,
      success: pickupResult.success,
      modifiers: pickupModifiers,
    },
  );
  newState = {
    ...newState,
    lastDiceResult: pickupResult,
    gameLog: [...newState.gameLog, pickupLogEntry],
  };

  if (pickupResult.success) {
    // Ramassage reussi : attacher la balle au joueur (immutable update).
    const successLogEntry = createLogEntry(
      'action',
      `Ballon ramassé avec succès`,
      player.id,
      player.team,
    );
    newState = {
      ...newState,
      ball: undefined,
      players: newState.players.map((p) =>
        p.id === player.id ? { ...p, hasBall: true } : p,
      ),
      gameLog: [...newState.gameLog, successLogEntry],
    };

    // Si pickup dans l'en-but adverse, touchdown immediat
    const picker = newState.players.find((p) => p.id === player.id);
    if (picker && isInOpponentEndzone(newState, picker)) {
      return awardTouchdown(newState, picker.team, picker);
    }
    return newState;
  }

  // Echec de pickup : offrir relance d'equipe si disponible
  if (canUseTeamReroll(newState, player.team)) {
    return {
      ...newState,
      pendingReroll: {
        rollType: 'pickup',
        playerId: player.id,
        team: player.team,
        targetNumber: pickupResult.targetNumber,
        modifiers: pickupModifiers,
        playerIndex: idx,
      },
    };
  }

  // Pas de relance : la balle rebondit et turnover
  const failLogEntry = createLogEntry(
    'turnover',
    `Échec du ramassage - Turnover`,
    player.id,
    player.team,
  );
  newState = {
    ...newState,
    isTurnover: true,
    gameLog: [...newState.gameLog, failLogEntry],
  };

  // Faire rebondir la balle
  return bounceBall(newState, rng);
}
