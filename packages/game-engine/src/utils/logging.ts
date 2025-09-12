/**
 * Système de logging pour le jeu Blood Bowl
 * Gère la création et l'ajout d'entrées de log
 */

import { GameState, GameLogEntry, TeamId } from '../core/types';

/**
 * Crée une nouvelle entrée de log
 * @param type - Type de l'entrée de log
 * @param message - Message à logger
 * @param playerId - ID du joueur concerné (optionnel)
 * @param team - Équipe concernée (optionnel)
 * @param details - Détails supplémentaires (optionnel)
 * @returns Une nouvelle entrée de log
 */
export function createLogEntry(
  type: GameLogEntry['type'],
  message: string,
  playerId?: string,
  team?: TeamId,
  details?: Record<string, unknown>
): GameLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    message,
    playerId,
    team,
    details,
  };
}

/**
 * Ajoute une entrée de log à l'état du jeu
 * @param state - État actuel du jeu
 * @param entry - Entrée de log à ajouter
 * @returns Nouvel état du jeu avec l'entrée de log ajoutée
 */
export function addLogEntry(state: GameState, entry: GameLogEntry): GameState {
  return {
    ...state,
    gameLog: [...state.gameLog, entry],
  };
}
