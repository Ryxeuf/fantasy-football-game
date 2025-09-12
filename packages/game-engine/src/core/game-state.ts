/**
 * Gestion de l'état du jeu pour Blood Bowl
 * Gère les tours, les mi-temps, les actions des joueurs et les compteurs
 */

import { GameState, TeamId, ActionType } from './types';
import { createLogEntry } from '../utils/logging';
import { checkTouchdowns } from '../mechanics/ball';
import { initializeDugouts } from '../mechanics/dugout';

/**
 * Configuration initiale du jeu
 * @param seed - Graine pour la reproductibilité (optionnel)
 * @returns État initial du jeu
 */
export function setup(): GameState {
  const dugouts = initializeDugouts();
  
  return {
    width: 26,
    height: 15,
    players: [
      {
        id: 'A1',
        team: 'A',
        pos: { x: 11, y: 7 },
        name: 'Grim Ironjaw',
        number: 1,
        position: 'Blitzer',
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: ['Block', 'Tackle'],
        pm: 7,
        hasBall: false,
        state: 'active',
      },
      {
        id: 'A2',
        team: 'A',
        pos: { x: 10, y: 7 },
        name: 'Thunder Stonefist',
        number: 2,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
        pm: 6,
        hasBall: false,
        state: 'active',
      },
      {
        id: 'B1',
        team: 'B',
        pos: { x: 15, y: 7 },
        name: 'Shadow Swift',
        number: 1,
        position: 'Runner',
        ma: 8,
        st: 2,
        ag: 4,
        pa: 3,
        av: 7,
        skills: ['Dodge', 'Sure Hands'],
        pm: 8,
        hasBall: false,
        state: 'active',
      },
      {
        id: 'B2',
        team: 'B',
        pos: { x: 16, y: 7 },
        name: 'Iron Hide',
        number: 2,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
        pm: 6,
        hasBall: false,
        state: 'active',
      },
    ],
    ball: { x: 13, y: 7 },
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: new Map<string, ActionType>(),
    teamBlitzCount: new Map<TeamId, number>(),
    // Informations de match
    half: 1,
    score: {
      teamA: 0,
      teamB: 0,
    },
    teamNames: {
      teamA: 'Orcs de Fer',
      teamB: 'Elfes Sombres',
    },
    // Log du match
    gameLog: [createLogEntry('info', 'Match commencé - Orcs de Fer vs Elfes Sombres')],
  };
}

/**
 * Gère la fin de tour et de mi-temps (8 tours par équipe / 8 "rounds")
 * @param state - État du jeu
 * @returns Nouvel état du jeu après vérification de la mi-temps
 */
export function advanceHalfIfNeeded(state: GameState): GameState {
  // Si on a dépassé le 8e round, on passe à la mi‑temps suivante ou on termine le match
  if (state.turn > 8) {
    if (state.half === 1) {
      const halftimeLog = createLogEntry(
        'info',
        `Mi-temps atteinte (8 tours par équipe). Début de la 2e mi-temps`,
        undefined,
        undefined
      );

      return {
        ...state,
        half: 2,
        turn: 1,
        currentPlayer: 'A',
        gameLog: [...state.gameLog, halftimeLog],
      };
    } else {
      const endLog = createLogEntry(
        'info',
        `Fin du match (2e mi-temps terminée)`,
        undefined,
        undefined
      );
      return {
        ...state,
        isTurnover: true,
        gameLog: [...state.gameLog, endLog],
      };
    }
  }
  return state;
}

/**
 * Vérifie si un joueur a déjà agi ce tour
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur a agi
 */
export function hasPlayerActed(state: GameState, playerId: string): boolean {
  return state.playerActions.has(playerId);
}

/**
 * Vérifie si un joueur peut agir
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur peut agir
 */
export function canPlayerAct(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // Un joueur ne peut pas agir s'il est étourdi ou n'a plus de PM
  return !player.stunned && player.pm > 0;
}

/**
 * Vérifie si un joueur peut bouger
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur peut bouger
 */
export function canPlayerMove(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // Un joueur peut bouger s'il n'est pas étourdi, a des PM, n'a pas encore fait d'action principale,
  // et c'est le tour de son équipe
  return !player.stunned && player.pm > 0 && !hasPlayerActed(state, playerId) && player.team === state.currentPlayer;
}

/**
 * Vérifie si un joueur peut continuer à bouger
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur peut continuer à bouger
 */
export function canPlayerContinueMoving(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // Un joueur peut continuer à bouger s'il n'est pas étourdi, a des PM, c'est le tour de son équipe,
  // et soit il n'a pas encore agi, soit il a déjà commencé à bouger ou fait un blitz
  const playerAction = getPlayerAction(state, playerId);
  return (
    !player.stunned &&
    player.pm > 0 &&
    player.team === state.currentPlayer &&
    (!hasPlayerActed(state, playerId) || playerAction === 'MOVE' || playerAction === 'BLITZ')
  );
}

/**
 * Obtient l'action d'un joueur
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns Action du joueur ou undefined
 */
export function getPlayerAction(state: GameState, playerId: string): ActionType | undefined {
  return state.playerActions.get(playerId);
}

/**
 * Définit l'action d'un joueur
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @param action - Action à définir
 * @returns Nouvel état du jeu
 */
export function setPlayerAction(state: GameState, playerId: string, action: ActionType): GameState {
  const newPlayerActions = new Map(state.playerActions);
  newPlayerActions.set(playerId, action);
  return {
    ...state,
    playerActions: newPlayerActions,
  };
}

/**
 * Efface toutes les actions des joueurs
 * @param state - État du jeu
 * @returns Nouvel état du jeu
 */
export function clearPlayerActions(state: GameState): GameState {
  return {
    ...state,
    playerActions: new Map<string, ActionType>(),
  };
}

/**
 * Obtient le nombre de blitz effectués par une équipe
 * @param state - État du jeu
 * @param team - Équipe
 * @returns Nombre de blitz effectués
 */
export function getTeamBlitzCount(state: GameState, team: TeamId): number {
  return state.teamBlitzCount?.get(team) || 0;
}

/**
 * Vérifie si une équipe peut effectuer un blitz
 * @param state - État du jeu
 * @param team - Équipe
 * @returns True si l'équipe peut blitzer
 */
export function canTeamBlitz(state: GameState, team: TeamId): boolean {
  return getTeamBlitzCount(state, team) < 1;
}

/**
 * Incrémente le compteur de blitz d'une équipe
 * @param state - État du jeu
 * @param team - Équipe
 * @returns Nouvel état du jeu
 */
export function incrementTeamBlitzCount(state: GameState, team: TeamId): GameState {
  const newTeamBlitzCount = new Map(state.teamBlitzCount);
  const currentCount = newTeamBlitzCount.get(team) || 0;
  newTeamBlitzCount.set(team, currentCount + 1);

  return {
    ...state,
    teamBlitzCount: newTeamBlitzCount,
  };
}

/**
 * Efface tous les compteurs de blitz
 * @param state - État du jeu
 * @returns Nouvel état du jeu
 */
export function clearTeamBlitzCounts(state: GameState): GameState {
  return {
    ...state,
    teamBlitzCount: new Map<TeamId, number>(),
  };
}

/**
 * Vérifie si le tour d'un joueur doit se terminer
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le tour doit se terminer
 */
export function shouldEndPlayerTurn(state: GameState, playerId: string): boolean {
  // Un joueur finit son tour s'il a effectué une action
  return hasPlayerActed(state, playerId);
}

/**
 * Termine le tour d'un joueur
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns Nouvel état du jeu
 */
export function endPlayerTurn(state: GameState, playerId: string): GameState {
  // Marquer le joueur comme ayant fini son tour
  const newState = setPlayerAction(state, playerId, 'MOVE');

  // Log de fin de tour du joueur
  const player = state.players.find(p => p.id === playerId);
  if (player) {
    const logEntry = createLogEntry(
      'action',
      `Fin du tour de ${player.name}`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, logEntry];
  }

  return checkTouchdowns(newState);
}

/**
 * Vérifie si le tour d'un joueur doit se terminer automatiquement
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns Nouvel état du jeu
 */
export function checkPlayerTurnEnd(state: GameState, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Si le joueur n'a plus de PM et a commencé à bouger, finir son tour
  if (
    player.pm <= 0 &&
    hasPlayerActed(state, playerId) &&
    (getPlayerAction(state, playerId) === 'MOVE' || getPlayerAction(state, playerId) === 'BLITZ')
  ) {
    return endPlayerTurn(state, playerId);
  }

  return state;
}

/**
 * Vérifie si le tour doit se terminer automatiquement
 * @param state - État du jeu
 * @returns True si le tour doit se terminer
 */
export function shouldAutoEndTurn(state: GameState): boolean {
  const team = state.currentPlayer;
  const teamPlayers = state.players.filter(p => p.team === team);

  // Vérifier si tous les joueurs de l'équipe ont agi ou ne peuvent plus agir
  return teamPlayers.every(
    player => hasPlayerActed(state, player.id) || player.stunned || player.pm <= 0
  );
}

/**
 * Gère le changement de joueur sélectionné
 * @param state - État du jeu
 * @param newPlayerId - ID du nouveau joueur sélectionné
 * @returns Nouvel état du jeu
 */
export function handlePlayerSwitch(state: GameState, newPlayerId: string): GameState {
  // Si on change de joueur, finir le tour du joueur précédemment sélectionné
  if (state.selectedPlayerId && state.selectedPlayerId !== newPlayerId) {
    const previousPlayer = state.players.find(p => p.id === state.selectedPlayerId);
    if (previousPlayer && hasPlayerActed(state, previousPlayer.id)) {
      // Le joueur précédent a déjà agi, on ne peut pas le laisser actif
      return {
        ...state,
        selectedPlayerId: newPlayerId,
      };
    }
  }

  return {
    ...state,
    selectedPlayerId: newPlayerId,
  };
}

/**
 * Efface le résultat de dés
 * @param state - État du jeu
 * @returns Nouvel état du jeu
 */
export function clearDiceResult(state: GameState): GameState {
  return {
    ...state,
    lastDiceResult: undefined,
  };
}
