/**
 * S27.8.7 — Handlers de choix (suite a un blocage / poussee /
 * follow-up / relance d'equipe) extraits de `actions.ts`.
 *
 * Quatre handlers cohesifs autour des phases de choix utilisateur
 * apres un evenement initial :
 *  - `handleBlockChoose` : choix du resultat de des de bloc apres
 *    un blocage qui a roule plusieurs des (l'attaquant ou le
 *    defenseur via Both Down + Block / Wrestle).
 *  - `handlePushChoose` : choix de la direction de poussee parmi
 *    celles disponibles (Fend, Frenzy, chain push).
 *  - `handleFollowUpChoose` : confirmation du suivi (follow-up)
 *    apres une poussee classique.
 *  - `handleRerollChoose` : decision sur l'utilisation d'une
 *    relance d'equipe pour un jet rate (dodge / GFI / pickup),
 *    avec test Solitaire (Loner) le cas echeant.
 *
 * Aucune dependance interne au dispatcher : tout passe par les
 * modules deja extraits (`failure-helpers`, `ball-pickup`) +
 * `core/game-state` + `mechanics/*`.
 */

import type {
  GameState,
  Player,
  Position,
  RNG,
  TeamId,
  BlockResult,
} from '../core/types';
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
  getPlayerAction,
} from '../core/game-state';
import {
  resolveBlockResult,
  applyChainPush,
} from '../mechanics/blocking';
import { isFendActiveForFollowUp } from '../mechanics/fend';
import { hasFrenzy } from '../mechanics/frenzy';
import { getArmBarBonus } from '../mechanics/arm-bar';
import {
  isInOpponentEndzone,
  awardTouchdown,
  checkTouchdowns,
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
 * Gere le choix de resultat de blocage parmi les des roules.
 */
export function handleBlockChoose(
  state: GameState,
  move: {
    type: 'BLOCK_CHOOSE';
    playerId: string;
    targetId: string;
    result: BlockResult;
  },
  rng: RNG,
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingBlock ||
    state.pendingBlock.attackerId !== attacker.id ||
    state.pendingBlock.targetId !== target.id
  ) {
    return state; // pas de choix attendu
  }

  // Construire un resultat complet a partir du choix
  const blockResult = {
    type: 'block' as const,
    playerId: attacker.id,
    targetId: target.id,
    diceRoll: 0,
    result: move.result,
    offensiveAssists: state.pendingBlock.offensiveAssists,
    defensiveAssists: state.pendingBlock.defensiveAssists,
    totalStrength: state.pendingBlock.totalStrength,
    targetStrength: state.pendingBlock.targetStrength,
  };

  let newState = resolveBlockResult(
    { ...state, pendingBlock: undefined, lastDiceResult: undefined },
    blockResult,
    rng,
  );

  // Determiner si c'etait un blitz ou un blocage normal
  // Si le joueur a deja l'action BLITZ enregistree, c'est un blitz
  // Sinon, c'est un blocage normal
  const isBlitz =
    hasPlayerActed(state, attacker.id) &&
    getPlayerAction(state, attacker.id) === 'BLITZ';

  if (isBlitz) {
    // Pour un blitz, consommer 1 PM supplementaire pour le blocage
    const attackerIdx = newState.players.findIndex(
      (p) => p.id === attacker.id,
    );
    if (attackerIdx !== -1) {
      newState.players[attackerIdx].pm = Math.max(
        0,
        newState.players[attackerIdx].pm - 1,
      );
    }

    // Enregistrer l'action de blitz
    newState = setPlayerAction(newState, attacker.id, 'BLITZ');

    // Pour un blitz, ne pas terminer l'activation du joueur - il
    // peut continuer a bouger sauf si c'est un turnover.
    if (!newState.isTurnover) {
      // Le joueur peut continuer a bouger apres le blocage
    } else {
      // En cas de turnover, terminer l'activation
      newState = checkPlayerTurnEnd(newState, attacker.id);
    }
  } else {
    // Pour un blocage normal, terminer l'activation
    newState = setPlayerAction(newState, attacker.id, 'BLOCK');
    newState = checkPlayerTurnEnd(newState, attacker.id);
  }

  return newState;
}

/**
 * Gere le choix de direction de poussee.
 */
export function handlePushChoose(
  state: GameState,
  move: {
    type: 'PUSH_CHOOSE';
    playerId: string;
    targetId: string;
    direction: Position;
  },
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingPushChoice ||
    state.pendingPushChoice.attackerId !== attacker.id ||
    state.pendingPushChoice.targetId !== target.id
  ) {
    return state; // pas de choix de poussee attendu
  }

  // Verifier que la direction choisie est valide
  const isValidDirection = state.pendingPushChoice.availableDirections.some(
    (dir) => dir.x === move.direction.x && dir.y === move.direction.y,
  );
  if (!isValidDirection) return state;

  // Appliquer la poussee dans la direction choisie (avec chain push
  // si occupee)
  const newTargetPos = {
    x: target.pos.x + move.direction.x,
    y: target.pos.y + move.direction.y,
  };

  let newState = { ...state, pendingPushChoice: undefined } as GameState;

  // Fend : verifier avant la poussee (la cible doit etre debout). Sur
  // POW/STUMBLE sans Dodge, la cible est deja stunned avant d'arriver
  // ici, donc isFendActiveForFollowUp renverra false naturellement.
  const fendActive = isFendActiveForFollowUp(newState, attacker, target);

  // Chain push : si la destination est occupee, pousser le joueur qui
  // y est d'abord
  const rng = () => Math.random(); // RNG pour les surfs en chaine
  newState = applyChainPush(newState, target.id, move.direction, rng);

  const frenzyActive = hasFrenzy(attacker) && !!newState.pendingFrenzyBlock;

  if (fendActive) {
    const fendLog = createLogEntry(
      'action',
      `${target.name} utilise Fend : ${attacker.name} ne peut pas suivre`,
      target.id,
      target.team,
      { skill: 'fend' },
    );
    newState.gameLog = [...newState.gameLog, fendLog];
    // Fend annule le suivi -> pas de second bloc frenzy
    newState.pendingFrenzyBlock = undefined;
  } else if (frenzyActive) {
    // Frenzy : follow-up obligatoire
    newState.players = newState.players.map((p) =>
      p.id === attacker.id ? { ...p, pos: target.pos } : p,
    );
    const frenzyFollowLog = createLogEntry(
      'action',
      `${attacker.name} suit ${target.name} (Frenzy — obligatoire)`,
      attacker.id,
      attacker.team,
      { skill: 'frenzy' },
    );
    newState.gameLog = [...newState.gameLog, frenzyFollowLog];
  } else {
    // Demander confirmation pour le follow-up
    newState.pendingFollowUpChoice = {
      attackerId: attacker.id,
      targetId: target.id,
      targetNewPosition: newTargetPos,
      targetOldPosition: target.pos,
    };
  }

  // Log de la poussee
  const pushLog = createLogEntry(
    'action',
    `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y}) par ${attacker.name}`,
    attacker.id,
    attacker.team,
  );
  newState.gameLog = [...newState.gameLog, pushLog];

  return checkTouchdowns(newState);
}

/**
 * Gere le choix de follow-up apres une poussee classique.
 */
export function handleFollowUpChoose(
  state: GameState,
  move: {
    type: 'FOLLOW_UP_CHOOSE';
    playerId: string;
    targetId: string;
    followUp: boolean;
  },
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingFollowUpChoice ||
    state.pendingFollowUpChoice.attackerId !== attacker.id ||
    state.pendingFollowUpChoice.targetId !== target.id
  ) {
    return state; // pas de choix de follow-up attendu
  }

  const newState = { ...state, pendingFollowUpChoice: undefined };

  if (move.followUp) {
    // L'attaquant suit le joueur pousse
    newState.players = newState.players.map((p) =>
      p.id === attacker.id
        ? { ...p, pos: state.pendingFollowUpChoice!.targetOldPosition }
        : p,
    );

    const followUpLog = createLogEntry(
      'action',
      `${attacker.name} suit ${target.name} (follow-up)`,
      attacker.id,
      attacker.team,
    );
    newState.gameLog = [...newState.gameLog, followUpLog];
  } else {
    const noFollowUpLog = createLogEntry(
      'action',
      `${attacker.name} ne suit pas ${target.name}`,
      attacker.id,
      attacker.team,
    );
    newState.gameLog = [...newState.gameLog, noFollowUpLog];
  }

  return checkTouchdowns(newState);
}

/**
 * Gere le choix de relance d'equipe pour un jet rate (dodge / GFI /
 * pickup), avec test Solitaire (Loner) le cas echeant.
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
    targetNumber: _targetNumber,
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
