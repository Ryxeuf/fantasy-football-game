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

  // Sure Hands : relance automatique du pickup rate (via skill registry)
  if (!pickupResult.success && canSkillReroll(player, 'on-pickup', state)) {
    const rerollLog = createLogEntry(
      'dice',
      `Sure Hands : relance du ramassage (${pickupResult.diceRoll} raté)`,
      player.id,
      player.team,
    );
    state.gameLog = [...state.gameLog, rerollLog];
    pickupResult = performPickupRollWithNotification(
      player,
      rng,
      pickupModifiers,
    );
  }

  // Stocker le resultat pour l'affichage
  state.lastDiceResult = pickupResult;

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
  state.gameLog = [...state.gameLog, pickupLogEntry];

  if (pickupResult.success) {
    // Ramassage reussi : attacher la balle au joueur
    state.ball = undefined;
    state.players[idx].hasBall = true;

    // Log du ramassage reussi
    const successLogEntry = createLogEntry(
      'action',
      `Ballon ramassé avec succès`,
      player.id,
      player.team,
    );
    state.gameLog = [...state.gameLog, successLogEntry];

    // Si pickup dans l'en-but adverse, touchdown immediat
    const picker = state.players[idx];
    if (isInOpponentEndzone(state, picker)) {
      return awardTouchdown(state, picker.team, picker);
    }
  } else {
    // Echec de pickup : offrir relance d'equipe si disponible
    if (canUseTeamReroll(state, player.team)) {
      state.pendingReroll = {
        rollType: 'pickup',
        playerId: player.id,
        team: player.team,
        targetNumber: pickupResult.targetNumber,
        modifiers: pickupModifiers,
        playerIndex: idx,
      };
      return state;
    }
    // Pas de relance : la balle rebondit et turnover
    state.isTurnover = true;

    // Log du ramassage echoue
    const failLogEntry = createLogEntry(
      'turnover',
      `Échec du ramassage - Turnover`,
      player.id,
      player.team,
    );
    state.gameLog = [...state.gameLog, failLogEntry];

    // Faire rebondir la balle
    return bounceBall(state, rng);
  }

  return state;
}
