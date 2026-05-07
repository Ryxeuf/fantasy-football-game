/**
 * S27.8.2 — Handlers de la famille pass extraits de `actions.ts`.
 *
 * Cinq handlers cohesifs autour des actions de passe / remise :
 *  - `handlePass` (regle PASS, integre On the Ball + Animosity +
 *    Running Pass).
 *  - `handleOnTheBallMove` / `handleOnTheBallDecline` : reaction du
 *    coach defenseur avant le declenchement effectif de la passe.
 *  - `handleHandoff` (HANDOFF, integre Animosity + Running Pass S3).
 *  - `handleThrowTeamMate` (THROW_TEAM_MATE).
 *
 * Reduction de bruit dans `actions.ts` : ~210 lignes en moins.
 * Aucune logique modifiee, les flots Animosity / On the Ball /
 * Running Pass sont identiques. La cyclic dependency entre
 * `handleOnTheBallMove` -> `handlePass` reste interne au module
 * (les deux fonctions sont co-localisees).
 */

import type { GameState, Player, RNG, Position, TeamId } from '../core/types';
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
} from '../core/game-state';
import {
  executePass,
  executeHandoff,
  getPassRange,
  canAttemptPassForRange,
} from '../mechanics/passing';
import { isAdjacent } from '../mechanics/movement';
import {
  canThrowTeamMate,
  getThrowRange,
  executeThrowTeamMate,
} from '../mechanics/throw-team-mate';
import { hasAnimosityAgainst, checkAnimosity } from '../mechanics/animosity';
import {
  canApplyRunningPass,
  canApplyRunningPassToHandoff,
  markRunningPassUsed,
} from '../mechanics/running-pass';
import {
  getOnTheBallReactivePlayers,
  executeOnTheBallMove,
  markOnTheBallUsed,
} from '../mechanics/on-the-ball';
import {
  canInstablePerformAction,
  logInstablePrevention,
} from '../mechanics/negative-traits';
import { createLogEntry } from '../utils/logging';

/**
 * Gere une action de passe (PASS).
 */
export function handlePass(
  state: GameState,
  move: { type: 'PASS'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const passer = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!passer || !target) return state;
  if (!passer.hasBall) return state;
  if (passer.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, passer.id)) return state;

  // Instable (Unstable): prohibition — Pass action cannot be declared.
  // No dice are rolled, no turnover. The action is simply rejected with a log.
  if (!canInstablePerformAction(passer, 'PASS')) {
    return logInstablePrevention(state, passer, 'PASS');
  }

  // Stunty: passes Long/Long Bomb interdites. L'action est rejetee sans dé
  // ni turnover (retourne l'etat inchange, le coach doit choisir un autre recepteur).
  const passRange = getPassRange(passer.pos, target.pos);
  if (!canAttemptPassForRange(passer, passRange)) {
    return state;
  }

  // ─── On the Ball : réaction adverse avant la passe ──────────────────
  const reactivePlayers = getOnTheBallReactivePlayers(state, passer.team);
  if (reactivePlayers.length > 0) {
    const otbLog = createLogEntry(
      'info',
      `Un joueur adverse peut activer Sur le Ballon avant la passe !`,
      undefined,
      reactivePlayers[0].team,
      { skill: 'on-the-ball' },
    );
    return {
      ...state,
      gameLog: [...state.gameLog, otbLog],
      pendingOnTheBall: {
        passerTeam: passer.team,
        pendingPassMove: {
          type: 'PASS',
          playerId: move.playerId,
          targetId: move.targetId,
        },
        reactivePlayers: reactivePlayers.map((p: Player) => p.id),
      },
    };
  }

  // Animosity check: roll D6 before pass if passer dislikes target
  let currentState = state;
  if (hasAnimosityAgainst(passer, target)) {
    const animResult = checkAnimosity(currentState, passer, target, rng);
    currentState = animResult.newState;
    if (!animResult.passed) {
      // Player refuses — activation ends, no turnover
      currentState = setPlayerAction(currentState, passer.id, 'PASS');
      currentState = checkPlayerTurnEnd(currentState, passer.id);
      return currentState;
    }
  }

  let newState = executePass(currentState, passer, target, rng);
  newState = setPlayerAction(newState, passer.id, 'PASS');

  // Running Pass : si le passeur a le skill, qu'il s'agit d'une Quick Pass
  // sans turnover et qu'il lui reste de la MA, il peut continuer son mouvement
  // apres la passe (une fois par tour). On ne le marque pas avant le passe pour
  // permettre la lecture du flag dans canApplyRunningPass / canPlayerContinueMoving.
  const passerAfter = newState.players.find((p) => p.id === passer.id);
  if (
    passerAfter &&
    canApplyRunningPass(newState, passerAfter, passRange, newState.isTurnover)
  ) {
    newState = markRunningPassUsed(newState, passer.id);
    const rpLog = createLogEntry(
      'info',
      `Passe dans la Course : ${passer.name} peut continuer son mouvement`,
      passer.id,
      passer.team,
      { skill: 'running-pass' },
    );
    newState = { ...newState, gameLog: [...newState.gameLog, rpLog] };
  }

  newState = checkPlayerTurnEnd(newState, passer.id);
  return newState;
}

/**
 * Gere le mouvement reactif On the Ball — le coach defenseur deplace un
 * joueur possedant le skill avant la passe.
 */
export function handleOnTheBallMove(
  state: GameState,
  move: { type: 'ON_THE_BALL_MOVE'; playerId: string; to: Position },
  rng: RNG,
): GameState {
  if (!state.pendingOnTheBall) return state;
  // Verifier que le joueur choisi fait partie des reactifs eligibles
  if (!state.pendingOnTheBall.reactivePlayers.includes(move.playerId))
    return state;

  const passMove = state.pendingOnTheBall.pendingPassMove;
  let next: GameState = { ...state, pendingOnTheBall: undefined };

  // Executer le mouvement On the Ball
  next = executeOnTheBallMove(next, move.playerId, move.to, rng);

  // Reprendre la passe initiale
  return handlePass(next, passMove, rng);
}

/**
 * Le coach defenseur decline On the Ball — la passe reprend normalement.
 */
export function handleOnTheBallDecline(state: GameState, rng: RNG): GameState {
  if (!state.pendingOnTheBall) return state;

  const passMove = state.pendingOnTheBall.pendingPassMove;
  const opposingTeam: TeamId =
    state.pendingOnTheBall.passerTeam === 'A' ? 'B' : 'A';
  let next: GameState = { ...state, pendingOnTheBall: undefined };

  // Marquer l'utilisation pour que handlePass ne re-declenche pas
  next = markOnTheBallUsed(next, opposingTeam);

  const declineLog = createLogEntry(
    'info',
    `Sur le Ballon decline par le coach defenseur`,
    undefined,
    opposingTeam,
    { skill: 'on-the-ball' },
  );
  next.gameLog = [...next.gameLog, declineLog];

  // Reprendre la passe initiale
  return handlePass(next, passMove, rng);
}

/**
 * Gere une action de remise (handoff).
 */
export function handleHandoff(
  state: GameState,
  move: { type: 'HANDOFF'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const passer = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!passer || !target) return state;
  if (!passer.hasBall) return state;
  if (passer.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, passer.id)) return state;
  if (!isAdjacent(passer.pos, target.pos)) return state;

  // Instable (Unstable): prohibition — Hand-Off action cannot be declared.
  if (!canInstablePerformAction(passer, 'HANDOFF')) {
    return logInstablePrevention(state, passer, 'HANDOFF');
  }

  // Animosity check: roll D6 before handoff if passer dislikes target
  let currentState = state;
  if (hasAnimosityAgainst(passer, target)) {
    const animResult = checkAnimosity(currentState, passer, target, rng);
    currentState = animResult.newState;
    if (!animResult.passed) {
      // Player refuses — activation ends, no turnover
      currentState = setPlayerAction(currentState, passer.id, 'HANDOFF');
      currentState = checkPlayerTurnEnd(currentState, passer.id);
      return currentState;
    }
  }

  let newState = executeHandoff(currentState, passer, target, rng);
  newState = setPlayerAction(newState, passer.id, 'HANDOFF');

  // Running Pass (variante S3) : un Hand-Off s'integre dans la regle ; meme
  // resolution que pour une Quick Pass.
  const passerAfter = newState.players.find((p) => p.id === passer.id);
  if (
    passerAfter &&
    canApplyRunningPassToHandoff(newState, passerAfter, newState.isTurnover)
  ) {
    newState = markRunningPassUsed(newState, passer.id);
    const rpLog = createLogEntry(
      'info',
      `Transmission dans la course : ${passer.name} peut continuer son mouvement`,
      passer.id,
      passer.team,
      { skill: 'running-pass-2025' },
    );
    newState = { ...newState, gameLog: [...newState.gameLog, rpLog] };
  }

  newState = checkPlayerTurnEnd(newState, passer.id);
  return newState;
}

/**
 * Gere une action de Lancer de Coequipier (Throw Team-Mate).
 */
export function handleThrowTeamMate(
  state: GameState,
  move: {
    type: 'THROW_TEAM_MATE';
    playerId: string;
    thrownPlayerId: string;
    targetPos: Position;
  },
  rng: RNG,
): GameState {
  const thrower = state.players.find((p) => p.id === move.playerId);
  const thrown = state.players.find((p) => p.id === move.thrownPlayerId);

  if (!thrower || !thrown) return state;
  if (thrower.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, thrower.id)) return state;
  if (!canThrowTeamMate(state, thrower, thrown)) return state;

  // Instable (Unstable): prohibition — Throw Team-Mate action cannot be declared.
  if (!canInstablePerformAction(thrower, 'THROW_TEAM_MATE')) {
    return logInstablePrevention(state, thrower, 'THROW_TEAM_MATE');
  }

  // Verifier que la cible est dans la portee
  const range = getThrowRange(thrower.pos, move.targetPos);
  if (!range) return state;

  // Note: le test Always Hungry (BB3) est realise dans
  // executeThrowTeamMate, apres le deplacement mais avant le lancer.
  let newState = executeThrowTeamMate(
    state,
    thrower,
    thrown,
    move.targetPos,
    rng,
  );
  newState = setPlayerAction(newState, thrower.id, 'THROW_TEAM_MATE');
  newState = checkPlayerTurnEnd(newState, thrower.id);
  return newState;
}
