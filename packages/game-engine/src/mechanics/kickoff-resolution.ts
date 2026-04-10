/**
 * Résolution des événements de kickoff délégués au UI
 * Gère les 4 événements nécessitant une interaction joueur :
 * - Perfect Defence (l'équipe qui botte réorganise)
 * - High Kick (l'équipe qui reçoit place un joueur sous le ballon)
 * - Quick Snap (l'équipe qui reçoit déplace chaque joueur d'1 case)
 * - Blitz (l'équipe qui botte joue un tour immédiat)
 */

import { GameState, Position } from '../core/types';
import { inBounds } from './movement';
import { createLogEntry } from '../utils/logging';

/**
 * Vérifie si une position est sur la moitié de terrain d'une équipe
 * Team A: x = 0..12 (left), Team B: x = 13..25 (right)
 */
function isOnTeamHalf(pos: Position, team: 'A' | 'B', state: GameState): boolean {
  if (team === 'A') {
    return pos.x >= 0 && pos.x <= 12;
  }
  return pos.x >= 13 && pos.x < state.width;
}

/**
 * Résout l'événement Perfect Defence.
 * L'équipe qui botte peut réorganiser ses joueurs sur sa moitié de terrain.
 * Les joueurs doivent respecter les limites du terrain et ne pas chevaucher.
 */
export function resolveKickoffPerfectDefence(
  state: GameState,
  newPositions: Array<{ playerId: string; position: Position }>
): GameState {
  if (!state.pendingKickoffEvent || state.pendingKickoffEvent.type !== 'perfect-defence') {
    return state;
  }

  const team = state.pendingKickoffEvent.team;

  // Validate all positions
  const positionSet = new Set<string>();
  for (const { playerId, position } of newPositions) {
    const player = state.players.find(p => p.id === playerId);
    if (!player || player.team !== team) return state;
    if (!inBounds(state, position)) return state;
    if (!isOnTeamHalf(position, team, state)) return state;

    const key = `${position.x},${position.y}`;
    if (positionSet.has(key)) return state; // duplicate position
    positionSet.add(key);
  }

  // Check no overlap with players not being moved (opponent players, own team not in the move list)
  const movedIds = new Set(newPositions.map(p => p.playerId));
  const fixedPlayers = state.players.filter(p => !movedIds.has(p.id) && p.pos.x >= 0);
  for (const fp of fixedPlayers) {
    if (positionSet.has(`${fp.pos.x},${fp.pos.y}`)) return state;
  }

  // Apply new positions
  const updatedPlayers = state.players.map(p => {
    const move = newPositions.find(m => m.playerId === p.id);
    if (move) {
      return { ...p, pos: { ...move.position } };
    }
    return p;
  });

  const log = createLogEntry(
    'action',
    `Défense parfaite : l'équipe qui botte a réorganisé ses joueurs`
  );

  return {
    ...state,
    players: updatedPlayers,
    pendingKickoffEvent: undefined,
    gameLog: [...state.gameLog, log],
  };
}

/**
 * Résout l'événement High Kick.
 * Un joueur de l'équipe qui reçoit peut être déplacé sous le ballon,
 * à condition qu'il ne soit pas dans une zone de tacle adverse.
 * @param playerId - ID du joueur à déplacer, ou null pour décliner
 */
export function resolveKickoffHighKick(
  state: GameState,
  playerId: string | null
): GameState {
  if (!state.pendingKickoffEvent || state.pendingKickoffEvent.type !== 'high-kick') {
    return state;
  }

  const team = state.pendingKickoffEvent.team;
  const ballPosition = state.pendingKickoffEvent.ballPosition ?? state.ball;

  // Decline the event
  if (playerId === null) {
    const log = createLogEntry('action', `Coup en hauteur décliné`);
    return {
      ...state,
      pendingKickoffEvent: undefined,
      gameLog: [...state.gameLog, log],
    };
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player || player.team !== team) return state;

  // Check the player is not in an enemy tackle zone
  const opponents = state.players.filter(
    p => p.team !== team && p.state === 'active' && !p.stunned
  );
  const isInTackleZone = opponents.some(opp => {
    const dx = Math.abs(opp.pos.x - player.pos.x);
    const dy = Math.abs(opp.pos.y - player.pos.y);
    return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
  });

  if (isInTackleZone) return state;

  if (!ballPosition) return state;

  // Move player under the ball
  const updatedPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, pos: { ...ballPosition } } : p
  );

  const log = createLogEntry(
    'action',
    `Coup en hauteur : ${player.name} se place sous le ballon en (${ballPosition.x}, ${ballPosition.y})`
  );

  return {
    ...state,
    players: updatedPlayers,
    pendingKickoffEvent: undefined,
    gameLog: [...state.gameLog, log],
  };
}

/**
 * Résout l'événement Quick Snap.
 * Chaque joueur de l'équipe qui reçoit peut se déplacer d'1 case.
 * @param moves - Array de déplacements { playerId, to } (max 1 case de distance)
 */
export function resolveKickoffQuickSnap(
  state: GameState,
  moves: Array<{ playerId: string; to: Position }>
): GameState {
  if (!state.pendingKickoffEvent || state.pendingKickoffEvent.type !== 'quick-snap') {
    return state;
  }

  const team = state.pendingKickoffEvent.team;

  // Empty moves = skip the event
  if (moves.length === 0) {
    const log = createLogEntry('action', `Snap rapide : aucun joueur déplacé`);
    return {
      ...state,
      pendingKickoffEvent: undefined,
      gameLog: [...state.gameLog, log],
    };
  }

  // Validate all moves
  const newPositions = new Map<string, Position>();
  for (const { playerId, to } of moves) {
    const player = state.players.find(p => p.id === playerId);
    if (!player || player.team !== team) return state;

    // Must be exactly 1 square (including diagonal)
    const dx = Math.abs(to.x - player.pos.x);
    const dy = Math.abs(to.y - player.pos.y);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) return state;

    if (!inBounds(state, to)) return state;

    newPositions.set(playerId, to);
  }

  // Check for collisions: new positions must not overlap with each other or with unmoved players
  const positionSet = new Set<string>();
  // Add positions of unmoved players
  for (const p of state.players) {
    if (!newPositions.has(p.id) && p.pos.x >= 0) {
      positionSet.add(`${p.pos.x},${p.pos.y}`);
    }
  }
  // Check moved player destinations
  for (const [, to] of newPositions) {
    const key = `${to.x},${to.y}`;
    if (positionSet.has(key)) return state;
    positionSet.add(key);
  }

  // Apply moves
  const updatedPlayers = state.players.map(p => {
    const newPos = newPositions.get(p.id);
    if (newPos) {
      return { ...p, pos: { ...newPos } };
    }
    return p;
  });

  const log = createLogEntry(
    'action',
    `Snap rapide : ${moves.length} joueur(s) déplacé(s) d'une case`
  );

  return {
    ...state,
    players: updatedPlayers,
    pendingKickoffEvent: undefined,
    gameLog: [...state.gameLog, log],
  };
}

/**
 * Résout l'événement Blitz.
 * Active un tour immédiat pour l'équipe qui botte (sans passes ni remises).
 */
export function resolveKickoffBlitz(state: GameState): GameState {
  if (!state.pendingKickoffEvent || state.pendingKickoffEvent.type !== 'blitz') {
    return state;
  }

  const team = state.pendingKickoffEvent.team;

  const log = createLogEntry(
    'action',
    `Blitz ! L'équipe qui botte joue un tour immédiat (sans passes ni remises)`
  );

  return {
    ...state,
    pendingKickoffEvent: undefined,
    kickoffBlitzTurn: true,
    currentPlayer: team,
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    rerollUsedThisTurn: false,
    gameLog: [...state.gameLog, log],
  };
}
