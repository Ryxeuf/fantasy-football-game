/**
 * S27.8.12 — Module dedie aux 3 handlers de mouvement couples a
 * `getLegalMoves` (qui re-verifient la legalite du move via la liste
 * complete) : `handleLeap`, `handleMove`, `handleDodge`.
 *
 * Extrait depuis `actions/actions.ts` apres S27.8.11 qui a sorti
 * `getLegalMoves` dans son propre module — ce qui casse le cycle
 * d'import qui empechait jusqu'ici l'extraction de ces handlers.
 *
 * Aucune dependance vers `actions.ts` : tous les helpers proviennent
 * de `mechanics/*`, `core/*`, `actions/legal-moves`, `actions/move-handlers`,
 * `actions/ball-pickup`, `actions/failure-helpers`. Les regles metier
 * complete (jets de des, dodge modifiers, shadowing, break-tackle,
 * touchdown, ball pickup) restent inchangees.
 */

import { GameState, Move, Player, Position, RNG } from '../core/types';
import { cloneGameState } from '../core/clone-state';
import { hasSkill } from '../skills/skill-effects';
import { getDodgeSkillModifiers } from '../skills/skill-bridge';
import {
  samePos,
  requiresDodgeRoll,
  calculateDodgeModifiers,
} from '../mechanics/movement';
import {
  performDodgeRollWithNotification,
  performArmorRollWithNotification,
} from '../utils/dice-notifications';
import { performInjuryRoll } from '../mechanics/injury';
import { createLogEntry } from '../utils/logging';
import {
  isInOpponentEndzone,
  awardTouchdown,
  bounceBall,
} from '../mechanics/ball';
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
  handlePlayerSwitch,
} from '../core/game-state';
import { checkBreakTackle } from '../mechanics/break-tackle';
import { resolveShadowingAfterDodge } from '../mechanics/shadowing';
import { getLeapModifier, performLeapRoll } from '../mechanics/leap';
import { getLegalMoves } from './legal-moves';
import { applyRollFailure } from './failure-helpers';
import { handleBallPickup } from './ball-pickup';
import { handleDodgeRoll, handleNormalMove } from './move-handlers';

/**
 * Gere une action LEAP (Saut) — competence Leap ou trait Pogo Stick.
 *
 * Le joueur saute 2 cases (distance Chebyshev) depuis sa position actuelle.
 * Un seul test d'Agilite est effectue, qui remplace le jet d'esquive quand
 * le joueur quitte des zones de tacle. Coute 2 points de mouvement.
 * Echec = le joueur tombe a la case d'arrivee (armure + blessure + turnover
 * s'il portait le ballon).
 */
export function handleLeap(
  state: GameState,
  move: { type: 'LEAP'; playerId: string; to: Position },
  rng: RNG
): GameState {
  const idx = state.players.findIndex(p => p.id === move.playerId);
  if (idx === -1) return state;

  // Gestion du changement de joueur actif
  const newState = handlePlayerSwitch(state, move.playerId);

  // Vérifier que ce LEAP est bien légal (skill, distance, case libre, PM suffisants)
  const legal = getLegalMoves(newState).some(
    m => m.type === 'LEAP' && m.playerId === move.playerId && samePos(m.to, move.to)
  );
  if (!legal) return newState;

  if (newState.isTurnover) return newState;

  const player = newState.players[idx] as Player;
  const modifiers = getLeapModifier(player);

  // Jet d'Agilité pour le saut
  const leapResult = performLeapRoll(player, rng, modifiers);

  let next = cloneGameState(newState);
  next.lastDiceResult = leapResult;

  const leapLogEntry = createLogEntry(
    'dice',
    `Saut (Leap): ${leapResult.diceRoll}/${leapResult.targetNumber} ${leapResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    {
      diceRoll: leapResult.diceRoll,
      targetNumber: leapResult.targetNumber,
      success: leapResult.success,
      modifiers,
      skill: hasSkill(player, 'pogo-stick') ? 'pogo-stick' : 'leap',
    }
  );
  next.gameLog = [...next.gameLog, leapLogEntry];

  // Déplacer le joueur vers la case d'arrivée et consommer 2 PM (immutable).
  // BUG fix : avant, `next.players[idx].pos = ...` / `.pm = ...` mutaient
  // l'objet player dans le clone. Le clone est `structuredClone` donc safe
  // localement, mais cette convention est dangereuse — toute reassignation
  // future de `next` casserait la chaine. Maintenant via `players.map`.
  next = {
    ...next,
    players: next.players.map((p, i) =>
      i === idx
        ? { ...p, pos: { ...move.to }, pm: Math.max(0, p.pm - 2) }
        : p,
    ),
  };
  // Invariant ball : si le joueur porte le ballon, state.ball suit le leap.
  if (next.players[idx].hasBall) {
    next = { ...next, ball: { ...move.to } };
  }

  // Enregistrer l'action de mouvement si c'est le premier mouvement
  if (!hasPlayerActed(next, player.id)) {
    next = setPlayerAction(next, player.id, 'MOVE');
  }

  next = checkPlayerTurnEnd(next, player.id);

  if (!leapResult.success) {
    // Échec : le joueur tombe à la case d'arrivée (armure + blessure + turnover)
    return applyRollFailure(next, idx, rng);
  }

  // Succès : pas de jet d'esquive nécessaire même si on quittait des zones de tacle.
  // Touchdown si on porte la balle et qu'on atteint l'en-but adverse.
  const mover = next.players[idx] as Player;
  if (mover.hasBall && isInOpponentEndzone(next, mover)) {
    return awardTouchdown(next, mover.team, mover);
  }

  // Ramassage de balle si on atterrit sur le ballon.
  if (next.ball && samePos(next.ball, move.to)) {
    return handleBallPickup(next, player, rng, idx);
  }

  return next;
}

/**
 * Gere un mouvement simple. Aiguille vers `handleDodgeRoll` si le
 * deplacement requiert un jet d'esquive, sinon vers `handleNormalMove`.
 */
export function handleMove(
  state: GameState,
  move: { type: 'MOVE'; playerId: string; to: Position },
  rng: RNG
): GameState {
  const idx = state.players.findIndex(p => p.id === move.playerId);
  if (idx === -1) return state;

  // Gérer le changement de joueur
  const newState = handlePlayerSwitch(state, move.playerId);

  const legal = getLegalMoves(newState).some(
    (m: Move) => m.type === 'MOVE' && m.playerId === move.playerId && samePos(m.to, move.to)
  );
  if (!legal) return newState;

  const player = newState.players[idx] as Player;
  const from = player.pos;
  const to = move.to;

  // Si c'est un turnover, on ne peut pas faire de mouvement
  if (newState.isTurnover) {
    return newState;
  }

  // Vérifier si un jet d'esquive est nécessaire
  const needsDodge = requiresDodgeRoll(newState, from, to, player.team);

  if (needsDodge) {
    return handleDodgeRoll(newState, player, from, to, rng, idx);
  } else {
    return handleNormalMove(newState, player, from, to, rng, idx);
  }
}

/**
 * Gere une action d'esquive explicite (pour l'interface : le joueur
 * choisit volontairement un mouvement avec dodge).
 */
export function handleDodge(
  state: GameState,
  move: { type: 'DODGE'; playerId: string; from: Position; to: Position },
  rng: RNG
): GameState {
  const idx = state.players.findIndex(p => p.id === move.playerId);
  if (idx === -1) return state;

  const player = state.players[idx] as Player;
  const from = player.pos;
  const to = move.to;

  // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée + skills)
  const baseDodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);
  const skillDodgeModifiers = getDodgeSkillModifiers(state, player, from);
  const dodgeModifiers = baseDodgeModifiers + skillDodgeModifiers;

  const dodgeResult = performDodgeRollWithNotification(player, rng, dodgeModifiers);

  let next = cloneGameState(state);
  next.lastDiceResult = dodgeResult;

  // Log du jet d'esquive
  const dodgeLogEntry = createLogEntry(
    'dice',
    `Jet d'esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    {
      diceRoll: dodgeResult.diceRoll,
      targetNumber: dodgeResult.targetNumber,
      success: dodgeResult.success,
      modifiers: dodgeModifiers,
    }
  );
  next.gameLog = [...next.gameLog, dodgeLogEntry];

  // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue.
  // BUG fix immutabilite : avant, `next.players[idx].pos = ...` / `.pm = ...`
  // mutaient l'objet player dans le clone. Maintenant via spread immutable.
  next = {
    ...next,
    players: next.players.map((p, i) =>
      i === idx
        ? { ...p, pos: { ...move.to }, pm: Math.max(0, p.pm - 1) }
        : p,
    ),
  };
  // Invariant ball : si le joueur porte le ballon, state.ball suit le dodge.
  // Note : si l'esquive échoue, le ballon est explicitement bouncé plus bas.
  if (next.players[idx].hasBall) {
    next = { ...next, ball: { ...move.to } };
  }

  // Shadowing : résolu après le mouvement, indépendamment du résultat (BB3).
  next = resolveShadowingAfterDodge(next, player, from, rng);

  // Break Tackle (BB3): +1/+2 une fois par activation sur un Dodge raté.
  let dodgeSucceeded = dodgeResult.success;
  if (!dodgeSucceeded) {
    const breakTackleCheck = checkBreakTackle(
      next,
      next.players[idx] as Player,
      dodgeResult.diceRoll,
      dodgeResult.targetNumber,
      dodgeResult.success
    );
    if (breakTackleCheck.triggered) {
      next = breakTackleCheck.newState;
      dodgeSucceeded = true;
    }
  }

  if (dodgeSucceeded) {
    // Avancement d'état standard après mouvement réussi
    if (!hasPlayerActed(next, player.id)) {
      next = setPlayerAction(next, player.id, 'MOVE');
    }
    next = checkPlayerTurnEnd(next, player.id);

    // Événements liés à la balle
    const mover = next.players[idx] as Player;
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }
    if (next.ball && samePos(next.ball, to)) {
      return handleBallPickup(next, player, rng, idx);
    }

    return next;
  } else {
    // En cas d'échec: jet d'armure puis potentiellement blessure/turnover
    const armorResult = performArmorRollWithNotification(player, rng);
    const armorSuccess = armorResult.success;
    next.lastDiceResult = armorResult;

    const armorLogEntry = createLogEntry(
      'dice',
      `Jet d'armure (Dodge échoué): ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorSuccess ? '✓' : '✗'}`,
      player.id,
      player.team,
      {
        diceRoll: armorResult.diceRoll,
        targetNumber: armorResult.targetNumber,
        success: armorSuccess,
      }
    );
    next.gameLog = [...next.gameLog, armorLogEntry];

    if (!armorSuccess) {
      // Armure percée: jet de blessure (stunned, KO ou casualty)
      next = performInjuryRoll(next, player, rng);
    } else {
      // Armure tient: joueur sonné (stunned)
      next.players[idx].state = 'stunned';
      next.players[idx].stunned = true;
    }

    // Si le joueur portait la balle, il la perd et elle rebondit
    if (next.players[idx]?.hasBall) {
      next.players[idx].hasBall = false;
      next.ball = { ...to };
      next = bounceBall(next, rng);
    }

    // Échec d'esquive entraîne turnover
    next.isTurnover = true;
    return next;
  }
}
