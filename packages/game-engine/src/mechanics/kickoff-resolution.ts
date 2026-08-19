/**
 * Résolution des événements de coup d'envoi délégués au UI (table 2025).
 * Gère les 4 événements nécessitant une décision de coach :
 * - Solide défense (4) : l'équipe qui engage replace jusqu'à D3+3 de
 *   ses joueurs Démarqués
 * - Chandelle (5) : l'équipe qui réceptionne place 1 joueur Démarqué
 *   sur la case d'atterrissage du ballon
 * - Surprise (9) : l'équipe qui réceptionne déplace jusqu'à D3+3 de ses
 *   joueurs Démarqués d'1 case
 * - Charge (10) : l'équipe qui engage active jusqu'à D3+3 de ses
 *   joueurs Démarqués
 *
 * Le plafond D3+3 et la liste des joueurs Démarqués sont tirés au
 * moment où l'événement est appliqué et transportés par
 * `state.pendingKickoffEvent` (`maxPlayers`, `eligiblePlayerIds`).
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
 * Résout l'événement « Solide défense » (4).
 * Le coach qui engage retire jusqu'à D3+3 de ses joueurs Démarqués et
 * les replace sur sa moitié de terrain, sans chevauchement.
 */
export function resolveKickoffSolidDefence(
  state: GameState,
  newPositions: Array<{ playerId: string; position: Position }>
): GameState {
  if (!state.pendingKickoffEvent || state.pendingKickoffEvent.type !== 'solid-defence') {
    return state;
  }

  const team = state.pendingKickoffEvent.team;

  // Plafond D3+3 tiré à l'application de l'événement.
  const maxPlayers = state.pendingKickoffEvent.maxPlayers;
  if (maxPlayers !== undefined && newPositions.length > maxPlayers) return state;

  // Seuls les joueurs Démarqués au moment du coup d'envoi sont éligibles.
  const eligible = state.pendingKickoffEvent.eligiblePlayerIds;
  if (eligible && newPositions.some(({ playerId }) => !eligible.includes(playerId))) {
    return state;
  }

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
    `Solide défense : ${newPositions.length} joueur(s) replacé(s) par l'équipe qui engage`
  );

  return {
    ...state,
    players: updatedPlayers,
    pendingKickoffEvent: undefined,
    gameLog: [...state.gameLog, log],
  };
}

/**
 * Résout l'événement « Chandelle » (5).
 * 1 joueur Démarqué de l'équipe qui réceptionne peut être placé sur la
 * case où le ballon va atterrir.
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
    const log = createLogEntry('action', `Chandelle déclinée`);
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
    `Chandelle : ${player.name} se place sous le ballon en (${ballPosition.x}, ${ballPosition.y})`
  );

  return {
    ...state,
    players: updatedPlayers,
    pendingKickoffEvent: undefined,
    gameLog: [...state.gameLog, log],
  };
}

/**
 * Résout l'événement « Surprise » (9).
 * Jusqu'à D3+3 joueurs Démarqués de l'équipe qui réceptionne se
 * déplacent d'1 case dans n'importe quelle direction (la moitié adverse
 * est autorisée).
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

  const maxPlayers = state.pendingKickoffEvent.maxPlayers;
  if (maxPlayers !== undefined && moves.length > maxPlayers) return state;

  const eligible = state.pendingKickoffEvent.eligiblePlayerIds;
  if (eligible && moves.some(({ playerId }) => !eligible.includes(playerId))) {
    return state;
  }

  // Empty moves = skip the event
  if (moves.length === 0) {
    const log = createLogEntry('action', `Surprise : aucun joueur déplacé`);
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
    `Surprise : ${moves.length} joueur(s) déplacé(s) d'une case`
  );

  return {
    ...state,
    players: updatedPlayers,
    pendingKickoffEvent: undefined,
    gameLog: [...state.gameLog, log],
  };
}

/**
 * Résout l'événement « Charge » (10).
 * Le coach qui engage désigne jusqu'à D3+3 de ses joueurs Démarqués ;
 * eux seuls peuvent ensuite être activés, un par un, pour une Action de
 * Mouvement gratuite (1 Blitz, 1 Lancer de Coéquipier et 1 Botter de
 * Coéquipier possibles à la place). Passes et remises restent interdites.
 *
 * @param selectedPlayerIds - joueurs désignés. Omis ⇒ tous les joueurs
 *   éligibles de l'équipe, dans la limite de `maxPlayers`.
 */
export function resolveKickoffBlitz(
  state: GameState,
  selectedPlayerIds?: string[]
): GameState {
  if (!state.pendingKickoffEvent || state.pendingKickoffEvent.type !== 'blitz') {
    return state;
  }

  const team = state.pendingKickoffEvent.team;
  const maxPlayers = state.pendingKickoffEvent.maxPlayers;
  const eligible = state.pendingKickoffEvent.eligiblePlayerIds;

  let chosen = selectedPlayerIds ?? eligible ?? [];
  if (selectedPlayerIds) {
    // Un joueur non Démarqué (ou d'une autre équipe) invalide le choix.
    if (eligible && selectedPlayerIds.some(id => !eligible.includes(id))) return state;
    if (maxPlayers !== undefined && selectedPlayerIds.length > maxPlayers) return state;
  } else if (maxPlayers !== undefined) {
    chosen = chosen.slice(0, maxPlayers);
  }

  const log = createLogEntry(
    'action',
    `Charge ! ${chosen.length} joueur(s) de l'équipe qui engage sont activés (sans passes ni remises)`
  );

  return {
    ...state,
    pendingKickoffEvent: undefined,
    kickoffBlitzTurn: true,
    kickoffBlitzPlayerIds: chosen,
    currentPlayer: team,
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    rerollUsedThisTurn: false,
    gameLog: [...state.gameLog, log],
  };
}
