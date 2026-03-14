/**
 * Validation par arbitre IA (server-side)
 * Vérifie la légalité de chaque action et détecte les incohérences d'état
 */

import { GameState, Move, Position, Player, TeamId } from '../core/types';
import { getLegalMoves } from '../actions/actions';
import { inBounds, isAdjacent } from '../mechanics/movement';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

/**
 * Valide un move avant son application
 */
export function validateMove(state: GameState, move: Move): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Vérifier que le match n'est pas terminé
  if (state.gamePhase === 'ended') {
    errors.push({ code: 'GAME_ENDED', message: 'Le match est terminé' });
    return { valid: false, errors, warnings };
  }

  // END_TURN est toujours valide
  if (move.type === 'END_TURN') {
    return { valid: true, errors, warnings };
  }

  // REROLL_CHOOSE est valide si un pending reroll existe
  if (move.type === 'REROLL_CHOOSE') {
    if (!state.pendingReroll) {
      errors.push({ code: 'NO_PENDING_REROLL', message: 'Aucune relance en attente' });
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  // Vérifier les états pending
  if (state.pendingBlock && move.type !== 'BLOCK_CHOOSE') {
    errors.push({ code: 'PENDING_BLOCK', message: 'Un choix de blocage est en attente' });
  }
  if (state.pendingPushChoice && move.type !== 'PUSH_CHOOSE') {
    errors.push({ code: 'PENDING_PUSH', message: 'Un choix de poussée est en attente' });
  }
  if (state.pendingFollowUpChoice && move.type !== 'FOLLOW_UP_CHOOSE') {
    errors.push({ code: 'PENDING_FOLLOWUP', message: 'Un choix de follow-up est en attente' });
  }

  // Vérifier que le move est dans la liste des moves légaux
  const legalMoves = getLegalMoves(state);
  const isLegal = legalMoves.some(lm => {
    if (lm.type !== move.type) return false;
    if ('playerId' in lm && 'playerId' in move && lm.playerId !== move.playerId) return false;
    if ('to' in lm && 'to' in move) {
      const lmTo = lm.to as Position;
      const mTo = move.to as Position;
      if (lmTo.x !== mTo.x || lmTo.y !== mTo.y) return false;
    }
    if ('targetId' in lm && 'targetId' in move && lm.targetId !== move.targetId) return false;
    return true;
  });

  if (!isLegal) {
    errors.push({
      code: 'ILLEGAL_MOVE',
      message: `Le mouvement ${move.type} n'est pas dans la liste des mouvements légaux`,
      details: { move, legalMovesCount: legalMoves.length },
    });
  }

  // Vérifications spécifiques par type
  if ('playerId' in move) {
    const player = state.players.find(p => p.id === move.playerId);
    if (!player) {
      errors.push({ code: 'PLAYER_NOT_FOUND', message: `Joueur ${move.playerId} introuvable` });
    } else {
      if (player.team !== state.currentPlayer) {
        errors.push({ code: 'WRONG_TEAM', message: `Ce n'est pas le tour de l'équipe ${player.team}` });
      }
      if (player.stunned) {
        errors.push({ code: 'PLAYER_STUNNED', message: `Le joueur ${player.name} est sonné` });
      }
    }
  }

  if (move.type === 'MOVE' && 'to' in move) {
    if (!inBounds(state, move.to)) {
      errors.push({ code: 'OUT_OF_BOUNDS', message: 'Destination hors du terrain' });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Vérifie la cohérence globale de l'état du jeu
 */
export function validateGameState(state: GameState): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Vérifier qu'il n'y a pas deux joueurs sur la même case
  const positionMap = new Map<string, string>();
  for (const player of state.players) {
    if (player.pos.x < 0 || player.pos.y < 0) continue; // Joueur hors terrain (dugout)
    const key = `${player.pos.x},${player.pos.y}`;
    if (positionMap.has(key)) {
      errors.push({
        code: 'DUPLICATE_POSITION',
        message: `Joueurs ${positionMap.get(key)} et ${player.id} sur la même case (${key})`,
      });
    }
    positionMap.set(key, player.id);
  }

  // Vérifier que le score est cohérent
  if (state.score.teamA < 0 || state.score.teamB < 0) {
    errors.push({ code: 'NEGATIVE_SCORE', message: 'Score négatif détecté' });
  }

  // Vérifier le tour
  if (state.turn < 1 || state.turn > 16) {
    warnings.push({ code: 'UNUSUAL_TURN', message: `Tour ${state.turn} inhabituel` });
  }

  // Vérifier la mi-temps
  if (state.half < 1 || state.half > 2) {
    if (state.half !== 0) { // 0 = pré-match
      warnings.push({ code: 'UNUSUAL_HALF', message: `Mi-temps ${state.half} inhabituelle` });
    }
  }

  // Vérifier le ballon
  if (state.ball) {
    if (!inBounds(state, state.ball)) {
      errors.push({ code: 'BALL_OUT_OF_BOUNDS', message: 'Le ballon est hors du terrain' });
    }
    // Vérifier que le ballon n'est pas sur un joueur sans hasBall
    const playerOnBall = state.players.find(
      p => p.pos.x === state.ball!.x && p.pos.y === state.ball!.y
    );
    if (playerOnBall && !playerOnBall.hasBall) {
      warnings.push({
        code: 'BALL_MISMATCH',
        message: `Le ballon est sur ${playerOnBall.name} mais hasBall=false`,
      });
    }
  }

  // Vérifier qu'un seul joueur a hasBall
  const ballCarriers = state.players.filter(p => p.hasBall);
  if (ballCarriers.length > 1) {
    errors.push({
      code: 'MULTIPLE_BALL_CARRIERS',
      message: `${ballCarriers.length} joueurs portent le ballon simultanément`,
    });
  }

  // Vérifier les PM négatifs
  for (const player of state.players) {
    if (player.pm < 0) {
      errors.push({
        code: 'NEGATIVE_PM',
        message: `${player.name} a ${player.pm} PM (négatif)`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
