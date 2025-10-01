/**
 * Gestion de l'état du jeu pour Blood Bowl
 * Gère les tours, les mi-temps, les actions des joueurs et les compteurs
 */

import { GameState, TeamId, ActionType, Player, Position } from './types';
import { createLogEntry } from '../utils/logging';
import { checkTouchdowns } from '../mechanics/ball';
import { initializeDugouts } from '../mechanics/dugout';

// Étendre GameState pour pré-match
export interface PreMatchState {
  phase: 'idle' | 'setup' | 'kickoff' | 'kickoff-sequence';
  currentCoach: TeamId;
  legalSetupPositions: Position[];
  placedPlayers: string[]; // IDs des joueurs placés
  kickingTeam: TeamId;
  receivingTeam: TeamId;
  // Nouvelles propriétés pour la séquence de kickoff
  kickoffStep?: 'place-ball' | 'kick-deviation' | 'kickoff-event';
  ballPosition?: Position | null; // Position initiale du ballon
  kickDeviation?: { d8: number; d6: number; direction: string } | null;
  kickoffEvent?: { dice: number; event: string; description: string } | null;
  finalBallPosition?: Position; // Position finale du ballon après déviation
}

export interface ExtendedGameState extends GameState {
  preMatch: PreMatchState;
}

/**
 * Interface pour les données de joueur depuis la base de données
 */
export interface TeamPlayerData {
  id: string;
  name: string;
  position: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
}

/**
 * Configuration initiale du jeu en phase pré-match avec les vraies équipes
 * Les joueurs commencent tous en réserves, pas sur le terrain
 * @param teamAData - Données des joueurs de l'équipe A
 * @param teamBData - Données des joueurs de l'équipe B
 * @param teamAName - Nom de l'équipe A
 * @param teamBName - Nom de l'équipe B
 * @returns État initial du jeu en phase pré-match
 */
export function setupPreMatchWithTeams(
  teamAData: TeamPlayerData[],
  teamBData: TeamPlayerData[],
  teamAName: string,
  teamBName: string
): ExtendedGameState {
  const dugouts = initializeDugouts();

  // Créer les joueurs de l'équipe A
  const teamAPlayers: Player[] = teamAData.map((tp, index) => ({
    id: `A${tp.number}`,
    team: 'A' as TeamId,
    pos: { x: -1, y: -1 }, // Position hors terrain
    name: tp.name,
    number: tp.number,
    position: tp.position,
    ma: tp.ma,
    st: tp.st,
    ag: tp.ag,
    pa: tp.pa,
    av: tp.av,
    skills: tp.skills
      ? tp.skills
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [],
    pm: tp.ma, // PM = MA au début
    hasBall: false,
    state: 'active',
  }));

  // Créer les joueurs de l'équipe B
  const teamBPlayers: Player[] = teamBData.map((tp, index) => ({
    id: `B${tp.number}`,
    team: 'B' as TeamId,
    pos: { x: -1, y: -1 }, // Position hors terrain
    name: tp.name,
    number: tp.number,
    position: tp.position,
    ma: tp.ma,
    st: tp.st,
    ag: tp.ag,
    pa: tp.pa,
    av: tp.av,
    skills: tp.skills
      ? tp.skills
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [],
    pm: tp.ma, // PM = MA au début
    hasBall: false,
    state: 'active',
  }));

  const allPlayers = [...teamAPlayers, ...teamBPlayers];

  // Mettre tous les joueurs en réserves
  allPlayers.forEach(player => {
    const teamId = player.team;
    const dugout = dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
    dugout.zones.reserves.players.push(player.id);
  });

  const existingState = {
    width: 26,
    height: 15,
    players: allPlayers,
    ball: undefined, // Pas de ballon en phase pré-match
    currentPlayer: 'A',
    turn: 0, // Pas de tour en phase pré-match
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: new Map<string, ActionType>(),
    teamBlitzCount: new Map<TeamId, number>(),
    // Informations de match
    half: 0, // Pas de mi-temps en phase pré-match
    score: {
      teamA: 0,
      teamB: 0,
    },
    teamNames: {
      teamA: teamAName,
      teamB: teamBName,
    },
    // Log du match
    gameLog: [
      createLogEntry(
        'info',
        `Phase pré-match - ${teamAName} vs ${teamBName} - Les joueurs sont en réserves`
      ),
    ],
  };

  return {
    ...existingState,
    preMatch: {
      phase: 'idle',
      currentCoach: 'A' as TeamId, // À set par backend après coin toss
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: 'B' as TeamId, // Placeholder, set par backend
      receivingTeam: 'A' as TeamId,
    },
  } as ExtendedGameState;
}

/**
 * Configuration initiale du jeu en phase pré-match (version de test)
 * Les joueurs commencent tous en réserves, pas sur le terrain
 * @param seed - Graine pour la reproductibilité (optionnel)
 * @returns État initial du jeu en phase pré-match
 */
export function setupPreMatch(): GameState {
  const dugouts = initializeDugouts();

  // Créer les joueurs mais les mettre en réserves (pas sur le terrain)
  const players: Player[] = [
    {
      id: 'A1',
      team: 'A' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
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
      team: 'A' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
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
      team: 'B' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
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
      team: 'B' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
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
  ];

  // Mettre tous les joueurs en réserves
  players.forEach(player => {
    const teamId = player.team;
    const dugout = dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
    dugout.zones.reserves.players.push(player.id);
  });

  return {
    width: 26,
    height: 15,
    players,
    ball: undefined, // Pas de ballon en phase pré-match
    currentPlayer: 'A',
    turn: 0, // Pas de tour en phase pré-match
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: new Map<string, ActionType>(),
    teamBlitzCount: new Map<TeamId, number>(),
    // Informations de match
    half: 0, // Pas de mi-temps en phase pré-match
    score: {
      teamA: 0,
      teamB: 0,
    },
    teamNames: {
      teamA: 'Orcs de Fer',
      teamB: 'Elfes Sombres',
    },
    // Log du match
    gameLog: [createLogEntry('info', 'Phase pré-match - Les joueurs sont en réserves')],
  };
}

/**
 * Configuration initiale du jeu (ancienne fonction pour compatibilité)
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
 * Transforme l'état pré-match en état de match démarré
 * Place les 4 premiers joueurs de chaque dugout sur le terrain aux positions initiales
 * @param state - État pré-match
 * @returns État de match démarré
 */
export function startMatchFromPreMatch(state: GameState): GameState {
  if (state.half !== 0) return state; // Déjà démarré

  // Positions initiales pour équipe A (locale)
  const positionsA = [
    { x: 11, y: 7 },
    { x: 10, y: 7 },
    { x: 6, y: 3 },
    { x: 6, y: 4 },
  ];

  // Positions initiales pour équipe B (visiteuse)
  const positionsB = [
    { x: 15, y: 7 },
    { x: 16, y: 7 },
    { x: 20, y: 3 },
    { x: 20, y: 4 },
  ];

  // Récupérer les IDs des joueurs en réserves
  const teamAReserves = [...state.dugouts.teamA.zones.reserves.players];
  const teamBReserves = [...state.dugouts.teamB.zones.reserves.players];

  // Les 4 premiers joueurs pour chaque équipe
  const teamAFirstIds = teamAReserves.slice(0, 4);
  const teamBFirstIds = teamBReserves.slice(0, 4);

  // Mettre à jour les positions des joueurs sur le terrain
  const newPlayers = state.players.map(player => {
    const newPos = { x: -1, y: -1 }; // Par défaut hors terrain
    if (teamAFirstIds.includes(player.id)) {
      const index = teamAFirstIds.indexOf(player.id);
      newPos.x = positionsA[index].x;
      newPos.y = positionsA[index].y;
    } else if (teamBFirstIds.includes(player.id)) {
      const index = teamBFirstIds.indexOf(player.id);
      newPos.x = positionsB[index].x;
      newPos.y = positionsB[index].y;
    }
    return { ...player, pos: newPos };
  });

  // Mettre à jour les dugouts : enlever les 4 premiers de réserves
  const newDugouts = {
    ...state.dugouts,
    teamA: {
      ...state.dugouts.teamA,
      zones: {
        ...state.dugouts.teamA.zones,
        reserves: {
          ...state.dugouts.teamA.zones.reserves,
          players: teamAReserves.slice(4),
        },
      },
    },
    teamB: {
      ...state.dugouts.teamB,
      zones: {
        ...state.dugouts.teamB.zones,
        reserves: {
          ...state.dugouts.teamB.zones.reserves,
          players: teamBReserves.slice(4),
        },
      },
    },
  };

  // Log de démarrage
  const startLog = createLogEntry(
    'info',
    'Match commencé - Placement initial des joueurs sur le terrain'
  );

  return {
    ...state,
    players: newPlayers,
    dugouts: newDugouts,
    half: 1,
    turn: 1,
    currentPlayer: 'A',
    ball: { x: 13, y: 7 }, // Ballon au centre
    selectedPlayerId: null,
    isTurnover: false,
    playerActions: new Map<string, ActionType>(),
    teamBlitzCount: new Map<TeamId, number>(),
    lastDiceResult: undefined,
    gameLog: [...state.gameLog, startLog],
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
export function hasPlayerActed(state: GameState | ExtendedGameState, playerId: string): boolean {
  if (!state.playerActions || typeof state.playerActions.has !== 'function') return false; // Guard pour JSON deserialized
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
  return (
    !player.stunned &&
    player.pm > 0 &&
    !hasPlayerActed(state, playerId) &&
    player.team === state.currentPlayer
  );
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
export function getPlayerAction(
  state: GameState | ExtendedGameState,
  playerId: string
): ActionType | undefined {
  if (!state.playerActions || typeof state.playerActions.get !== 'function') return undefined;
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
export function getTeamBlitzCount(state: GameState | ExtendedGameState, team: TeamId): number {
  if (!state.teamBlitzCount || typeof state.teamBlitzCount.get !== 'function') return 0;
  return state.teamBlitzCount.get(team) || 0;
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
  
  // Vérifier que state.players existe
  if (!state.players || !Array.isArray(state.players)) {
    return false;
  }
  
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

// Fonction pour entrer en phase setup (appelée après accepts et coin toss)
export function enterSetupPhase(
  state: ExtendedGameState,
  receivingTeam: TeamId
): ExtendedGameState {
  if (state.half !== 0 || (state.preMatch.phase !== 'idle' && state.preMatch.phase !== 'setup')) return state;

  // Positions légales de setup pour toute la moitié de terrain de l'équipe
  // Repère: board 26x15 (x: 0..25, y: 0..14). Bande touchdown sur y=0 (haut) et y=14 (bas).
  // On autorise: équipe A (haut) sur y=1..6, équipe B (bas) sur y=8..13. Toutes colonnes x=0..25.
  const buildHalf = (topHalf: boolean): Position[] => {
    const positions: Position[] = [];
    // Corriger la logique : équipe A (haut) sur x=1..12, équipe B (bas) sur x=13..24
    // Toutes les colonnes y=0..14 sont autorisées
    const xStart = topHalf ? 1 : 13; // exclure touchdown: 0 et 25
    const xEnd = topHalf ? 12 : 24;
    for (let x = xStart; x <= xEnd; x++) {
      for (let y = 0; y < state.height; y++) {
        positions.push({ x, y });
      }
    }
    return positions;
  };

  const setupPositions: Position[] = buildHalf(receivingTeam === 'A');

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'setup',
      currentCoach: receivingTeam,
      legalSetupPositions: setupPositions,
      placedPlayers: state.preMatch.phase === 'idle' ? [] : state.preMatch.placedPlayers, // Ne pas réinitialiser si on passe d'une équipe à l'autre
    },
  };
}

// Fonction pour placer un joueur en setup (appelée onCellClick si phase='setup')
export function placePlayerInSetup(
  state: ExtendedGameState,
  playerId: string,
  pos: Position
): ExtendedGameState {
  if (
    state.preMatch.phase !== 'setup' ||
    state.preMatch.currentCoach !== state.players.find(p => p.id === playerId)?.team ||
    !state.preMatch.legalSetupPositions.some(l => l.x === pos.x && l.y === pos.y)
  ) {
    return state; // Invalid move
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Permettre le repositionnement : si le joueur est déjà placé, on le retire d'abord
  const isRepositioning = player.pos.x >= 0;
  let currentPlacedPlayers = [...state.preMatch.placedPlayers];

  if (isRepositioning) {
    // Retirer le joueur de la liste des placés
    currentPlacedPlayers = currentPlacedPlayers.filter(id => id !== playerId);
  }

  // Vérifier qu'aucun autre joueur n'occupe déjà cette position
  const existingPlayerAtPos = state.players.find(
    p => p.pos.x === pos.x && p.pos.y === pos.y && p.id !== playerId
  );
  if (existingPlayerAtPos) {
    return state; // Position déjà occupée
  }

  // Simuler la pose pour vérifier les contraintes
  const simulatedPlayers = state.players.map(p => (p.id === playerId ? { ...p, pos } : p));
  const simulatedPlaced = [...currentPlacedPlayers, playerId];

  // Contraintes Blood Bowl (setup)
  const teamId = player.team;
  // Largeurs BB 2020: 3 colonnes de chaque côté sur un terrain 15 colonnes (0..14)
  const isLeftWideZone = (y: number) => y >= 0 && y <= 2;
  const isRightWideZone = (y: number) => y >= 12 && y <= 14;
  const isOnLos = (x: number) => (teamId === 'A' ? x === 12 : x === 13);

  const teamPlayersOnPitch = simulatedPlayers.filter(p => p.team === teamId && p.pos.x >= 0);
  if (teamPlayersOnPitch.length > 11) {
    return state; // max 11 sur le terrain
  }

  const leftWzCount = teamPlayersOnPitch.filter(p => isLeftWideZone(p.pos.y)).length;
  const rightWzCount = teamPlayersOnPitch.filter(p => isRightWideZone(p.pos.y)).length;
  if (leftWzCount > 2 || rightWzCount > 2) {
    return state; // max 2 par wide zone
  }

  // Vérifier à partir de l'avant-dernier joueur (quand il reste 2 joueurs à placer)
  // Si on a placé 9 joueurs ou plus, vérifier qu'on peut encore respecter la contrainte LOS
  if (simulatedPlaced.length >= 9) {
    const losCount = teamPlayersOnPitch.filter(p => isOnLos(p.pos.x)).length;
    const remainingPlayers = 11 - simulatedPlaced.length;
    const minLosRequired = 3;

    // Si on n'a pas assez de joueurs sur la LOS et qu'il ne reste pas assez de joueurs pour atteindre 3
    if (losCount < minLosRequired && losCount + remainingPlayers < minLosRequired) {
      return state; // Impossible d'atteindre 3 joueurs sur la LOS
    }
  }

  const newPlayers = simulatedPlayers;
  const newPlaced = simulatedPlaced;

  let newState = {
    ...state,
    players: newPlayers,
    preMatch: { ...state.preMatch, placedPlayers: newPlaced },
  };

  // Si 11 placés, switch to next coach or kickoff
  if (newPlaced.length === 11) {
    const nextCoach = state.preMatch.currentCoach === 'A' ? 'B' : 'A';
    // Toujours passer à l'autre équipe, puis vérifier si les deux ont terminé
    if (state.preMatch.currentCoach === state.preMatch.receivingTeam) {
      // L'équipe receveuse a terminé, passer à l'équipe frappeuse
      newState = enterSetupPhase(newState, nextCoach);
    } else {
      // L'équipe frappeuse a terminé, les deux équipes ont placé leurs joueurs
      newState.preMatch.phase = 'kickoff';
    }
  }

  return newState;
}

/**
 * Transforme l'état pré-match en état de kickoff avec les étapes manquantes
 * Tous les joueurs sont déjà placés sur le terrain
 * @param state - État pré-match en phase kickoff
 * @returns État de kickoff avec les étapes à suivre
 */
export function startKickoffSequence(state: ExtendedGameState): ExtendedGameState {
  if (state.half !== 0 || state.preMatch.phase !== 'kickoff') return state;

  // Créer un log de début de kickoff
  const kickoffLog = createLogEntry(
    'info',
    `Kickoff - ${state.teamNames.teamA} vs ${state.teamNames.teamB} - Début de la séquence de kickoff`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'kickoff-sequence',
      kickoffStep: 'place-ball', // Étapes: place-ball, kick-deviation, kickoff-event
      ballPosition: null, // Position initiale du ballon (à définir par le coach)
      kickDeviation: null, // Déviation du kick (D8 + D6)
      kickoffEvent: null, // Événement de kickoff (2D6)
    },
    gameLog: [...state.gameLog, kickoffLog],
  };
}

/**
 * Transforme l'état de kickoff en état de match démarré après résolution complète
 * @param state - État de kickoff avec toutes les étapes résolues
 * @returns État de match démarré
 */
export function startMatchFromKickoff(state: ExtendedGameState): GameState {
  if (state.half !== 0 || state.preMatch.phase !== 'kickoff-sequence') return state;

  // Créer un log de début de match
  const matchStartLog = createLogEntry(
    'info',
    `Match commencé - ${state.teamNames.teamA} vs ${state.teamNames.teamB} - Le jeu commence !`
  );

  // Retirer la propriété preMatch pour passer en mode match normal
  const { preMatch, ...matchState } = state;

  return {
    ...matchState,
    half: 1,
    turn: 1,
    currentPlayer: state.preMatch.receivingTeam, // L'équipe qui reçoit commence
    ball: state.preMatch.finalBallPosition || { x: 13, y: 7 }, // Position finale du ballon
    selectedPlayerId: null,
    isTurnover: false,
    playerActions: new Map<string, ActionType>(),
    teamBlitzCount: new Map<TeamId, number>(),
    lastDiceResult: undefined,
    gameLog: [...state.gameLog, matchStartLog],
  };
}

/**
 * Place le ballon pour le kickoff
 * @param state - État de kickoff
 * @param position - Position où placer le ballon
 * @returns Nouvel état avec ballon placé
 */
export function placeKickoffBall(state: ExtendedGameState, position: Position): ExtendedGameState {
  if (state.preMatch.phase !== 'kickoff-sequence' || state.preMatch.kickoffStep !== 'place-ball') {
    return state;
  }

  // Vérifier que la position est dans la moitié de l'équipe receveuse
  const receivingTeam = state.preMatch.receivingTeam;
  const isValidPosition = receivingTeam === 'A' ? 
    position.x >= 1 && position.x <= 12 : // Équipe A (haut)
    position.x >= 13 && position.x <= 24; // Équipe B (bas)

  if (!isValidPosition) {
    return state; // Position invalide
  }

  const logEntry = createLogEntry(
    'action',
    `Ballon placé en position (${position.x}, ${position.y}) pour le kickoff`,
    undefined,
    state.preMatch.kickingTeam
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      kickoffStep: 'kick-deviation',
      ballPosition: position,
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Calcule la déviation du kickoff
 * @param state - État de kickoff avec ballon placé
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état avec déviation calculée
 */
export function calculateKickDeviation(state: ExtendedGameState, rng: () => number): ExtendedGameState {
  if (state.preMatch.phase !== 'kickoff-sequence' || state.preMatch.kickoffStep !== 'kick-deviation') {
    return state;
  }

  const d8 = Math.floor(rng() * 8) + 1;
  const d6 = Math.floor(rng() * 6) + 1;
  
  // Déterminer la direction basée sur le D8
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const direction = directions[d8 - 1];

  // Calculer la nouvelle position du ballon
  const originalPos = state.preMatch.ballPosition!;
  let newX = originalPos.x;
  let newY = originalPos.y;

  // Appliquer la déviation selon la direction
  switch (direction) {
    case 'N': newY -= d6; break;
    case 'NE': newX += d6; newY -= d6; break;
    case 'E': newX += d6; break;
    case 'SE': newX += d6; newY += d6; break;
    case 'S': newY += d6; break;
    case 'SW': newX -= d6; newY += d6; break;
    case 'W': newX -= d6; break;
    case 'NW': newX -= d6; newY -= d6; break;
  }

  // Vérifier les limites du terrain
  newX = Math.max(0, Math.min(25, newX));
  newY = Math.max(0, Math.min(14, newY));

  const finalPosition = { x: newX, y: newY };

  const logEntry = createLogEntry(
    'action',
    `Déviation du kickoff: D8=${d8} (${direction}), D6=${d6} → Ballon en (${finalPosition.x}, ${finalPosition.y})`,
    undefined,
    state.preMatch.kickingTeam
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      kickoffStep: 'kickoff-event',
      kickDeviation: { d8, d6, direction },
      finalBallPosition: finalPosition,
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Résout l'événement de kickoff
 * @param state - État de kickoff avec déviation calculée
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état avec événement résolu
 */
export function resolveKickoffEvent(state: ExtendedGameState, rng: () => number): ExtendedGameState {
  if (state.preMatch.phase !== 'kickoff-sequence' || state.preMatch.kickoffStep !== 'kickoff-event') {
    return state;
  }

  const dice1 = Math.floor(rng() * 6) + 1;
  const dice2 = Math.floor(rng() * 6) + 1;
  const total = dice1 + dice2;

  // Table des événements de kickoff (simplifiée)
  const events: { [key: number]: { event: string; description: string } } = {
    2: { event: 'Get the Ref', description: 'Chaque équipe gagne un Bribe gratuit' },
    3: { event: 'Riot', description: 'Les fans envahissent le terrain - tous les joueurs sont repoussés' },
    4: { event: 'Perfect Defense', description: 'L\'équipe qui frappe peut repositionner D3 joueurs' },
    5: { event: 'High Kick', description: 'Le ballon est lancé haut - +1 pour attraper' },
    6: { event: 'Cheering Fans', description: 'Les fans encouragent - +1 Fan Factor pour cette mi-temps' },
    7: { event: 'Changing Weather', description: 'Le temps change - relancer la météo' },
    8: { event: 'Brilliant Coaching', description: 'L\'équipe qui frappe peut utiliser une reroll gratuite' },
    9: { event: 'Quick Snap', description: 'L\'équipe qui reçoit peut activer un joueur supplémentaire' },
    10: { event: 'Blitz', description: 'L\'équipe qui frappe peut activer D3+3 joueurs immédiatement' },
    11: { event: 'Officious Ref', description: 'L\'arbitre est strict - risque d\'exclusion' },
    12: { event: 'Pitch Invasion', description: 'Invasion du terrain - D3 joueurs de chaque équipe sont sonnés' },
  };

  const eventData = events[total] || { event: 'Normal', description: 'Kickoff normal' };

  const logEntry = createLogEntry(
    'action',
    `Événement de kickoff: ${dice1}+${dice2}=${total} - ${eventData.event}: ${eventData.description}`,
    undefined,
    state.preMatch.kickingTeam
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      kickoffEvent: { dice: total, event: eventData.event, description: eventData.description },
    },
    gameLog: [...state.gameLog, logEntry],
  };
}
