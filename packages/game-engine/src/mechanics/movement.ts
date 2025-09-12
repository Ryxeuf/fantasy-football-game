/**
 * Fonctions de mouvement et de position pour Blood Bowl
 * Gère les déplacements, les zones de tacle, et les calculs de distance
 */

import { GameState, Position, Player, TeamId } from '../core/types';

/**
 * Vérifie si une position est dans les limites du terrain
 * @param state - État du jeu
 * @param pos - Position à vérifier
 * @returns True si la position est dans les limites
 */
export function inBounds(state: GameState, pos: Position): boolean {
  return pos.x >= 0 && pos.x < state.width && pos.y >= 0 && pos.y < state.height;
}

/**
 * Vérifie si deux positions sont identiques
 * @param a - Première position
 * @param b - Deuxième position
 * @returns True si les positions sont identiques
 */
export function samePos(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Vérifie si une position est occupée par un joueur
 * @param state - État du jeu
 * @param pos - Position à vérifier
 * @returns True si la position est occupée
 */
export function isPositionOccupied(state: GameState, pos: Position): boolean {
  return state.players.some(p => p.pos.x === pos.x && p.pos.y === pos.y);
}

/**
 * Vérifie si deux positions sont adjacentes
 * @param pos1 - Première position
 * @param pos2 - Deuxième position
 * @returns True si les positions sont adjacentes
 */
export function isAdjacent(pos1: Position, pos2: Position): boolean {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
}

/**
 * Trouve tous les adversaires adjacents à une position
 * @param state - État du jeu
 * @param position - Position de référence
 * @param team - Équipe du joueur (pour identifier les adversaires)
 * @returns Liste des adversaires adjacents
 */
export function getAdjacentOpponents(state: GameState, position: Position, team: TeamId): Player[] {
  const opponents: Player[] = [];
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];

  for (const dir of dirs) {
    const checkPos = { x: position.x + dir.x, y: position.y + dir.y };
    const opponent = state.players.find(
      p => p.team !== team && p.pos.x === checkPos.x && p.pos.y === checkPos.y && !p.stunned
    );
    if (opponent) {
      opponents.push(opponent);
    }
  }

  return opponents;
}

/**
 * Trouve tous les joueurs adjacents à une position
 * @param state - État du jeu
 * @param position - Position de référence
 * @returns Liste des joueurs adjacents
 */
export function getAdjacentPlayers(state: GameState, position: Position): Player[] {
  const players: Player[] = [];
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];

  for (const dir of dirs) {
    const checkPos = { x: position.x + dir.x, y: position.y + dir.y };
    const player = state.players.find(
      p => p.pos.x === checkPos.x && p.pos.y === checkPos.y && !p.stunned
    );
    if (player) {
      players.push(player);
    }
  }

  return players;
}

/**
 * Calcule les modificateurs de désquive pour un mouvement
 * @param state - État du jeu
 * @param from - Position de départ
 * @param to - Position d'arrivée
 * @param team - Équipe du joueur
 * @returns Modificateurs de désquive (négatifs = malus)
 */
export function calculateDodgeModifiers(
  state: GameState,
  from: Position,
  to: Position,
  team: TeamId
): number {
  let modifiers = 0;

  // Malus pour chaque adversaire qui marque la case d'arrivée
  const opponentsAtTo = getAdjacentOpponents(state, to, team);
  modifiers -= opponentsAtTo.length; // -1 par adversaire adjacent à la case d'arrivée

  return modifiers;
}

/**
 * Calcule les modificateurs de ramassage de balle
 * @param state - État du jeu
 * @param ballPosition - Position de la balle
 * @param team - Équipe du joueur
 * @returns Modificateurs de pickup (négatifs = malus)
 */
export function calculatePickupModifiers(
  state: GameState,
  ballPosition: Position,
  team: TeamId
): number {
  let modifiers = 0;

  // Malus pour chaque adversaire qui marque la case où se trouve la balle
  const opponentsAtBall = getAdjacentOpponents(state, ballPosition, team);
  modifiers -= opponentsAtBall.length; // -1 par adversaire adjacent à la balle

  return modifiers;
}

/**
 * Vérifie si un jet d'esquive est nécessaire pour un mouvement
 * @param state - État du jeu
 * @param from - Position de départ
 * @param to - Position d'arrivée
 * @param team - Équipe du joueur
 * @returns True si un jet d'esquive est nécessaire
 */
export function requiresDodgeRoll(
  state: GameState,
  from: Position,
  to: Position,
  team: TeamId
): boolean {
  // Vérifier si le joueur sort d'une case où il était marqué par un adversaire
  const opponentsAtFrom = getAdjacentOpponents(state, from, team);

  // Pas de jet d'esquive si pas d'adversaires adjacents
  if (opponentsAtFrom.length === 0) {
    return false;
  }

  // Calculer la distance de mouvement
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.abs(dx) + Math.abs(dy); // Distance Manhattan

  // Si on ne bouge pas, pas de jet d'esquive
  if (distance === 0) {
    return false;
  }

  // En Blood Bowl : jet d'esquive nécessaire si on quitte une case marquée
  // Peu importe où on va, dès qu'on sort d'une zone de marquage, c'est un jet d'esquive
  return true;
}
