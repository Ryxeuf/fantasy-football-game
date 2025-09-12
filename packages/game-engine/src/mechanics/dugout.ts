/**
 * Gestion des zones de dugout pour Blood Bowl
 * Gère les réserves, sonnés, KO, blessés et exclus pour chaque équipe
 */

import { GameState, TeamId, Player, PlayerState, TeamDugout, DugoutZone } from '../core/types';

/**
 * Crée une zone de dugout
 */
function createDugoutZone(
  id: string,
  name: string,
  color: string,
  icon: string,
  maxCapacity: number,
  position: { x: number; y: number; width: number; height: number }
): DugoutZone {
  return {
    id,
    name,
    color,
    icon,
    maxCapacity,
    players: [],
    position
  };
}

/**
 * Crée un dugout complet pour une équipe
 */
export function createTeamDugout(teamId: TeamId): TeamDugout {
  const isTeamA = teamId === 'A';
  const baseX = isTeamA ? -200 : 26 * 28 + 20; // Position à gauche pour A, droite pour B
  const teamColor = isTeamA ? '#3B82F6' : '#EF4444'; // Bleu pour A, Rouge pour B
  
  return {
    teamId,
    zones: {
      reserves: createDugoutZone(
        `${teamId}-reserves`,
        'Réserves',
        '#90EE90', // Vert clair
        '👥',
        16,
        { x: baseX, y: 50, width: 150, height: 80 }
      ),
      stunned: createDugoutZone(
        `${teamId}-stunned`,
        'Sonnés (2-7)',
        '#FFA500', // Orange
        '😵',
        16,
        { x: baseX, y: 140, width: 150, height: 80 }
      ),
      knockedOut: createDugoutZone(
        `${teamId}-knocked-out`,
        'KO (8-9)',
        '#FF6B6B', // Rouge clair
        '🚑',
        16,
        { x: baseX, y: 230, width: 150, height: 80 }
      ),
      casualty: createDugoutZone(
        `${teamId}-casualty`,
        'Blessés (10+)',
        '#DC2626', // Rouge foncé
        '🩹',
        16,
        { x: baseX, y: 320, width: 150, height: 80 }
      ),
      sentOff: createDugoutZone(
        `${teamId}-sent-off`,
        'Exclus',
        '#374151', // Gris foncé
        '⚫',
        16,
        { x: baseX, y: 410, width: 150, height: 80 }
      )
    }
  };
}

/**
 * Initialise les dugouts pour les deux équipes
 */
export function initializeDugouts(): { teamA: TeamDugout; teamB: TeamDugout } {
  return {
    teamA: createTeamDugout('A'),
    teamB: createTeamDugout('B')
  };
}

/**
 * Déplace un joueur vers une zone de dugout
 */
export function movePlayerToDugoutZone(
  state: GameState,
  playerId: string,
  zoneType: keyof TeamDugout['zones'],
  teamId: TeamId
): GameState {
  const newState = structuredClone(state) as GameState;
  const player = newState.players.find(p => p.id === playerId);
  
  if (!player) return state;

  const dugout = newState.dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
  const zone = dugout.zones[zoneType];

  // Retirer le joueur de toutes les zones
  Object.values(dugout.zones).forEach(z => {
    z.players = z.players.filter(id => id !== playerId);
  });

  // Ajouter le joueur à la nouvelle zone
  if (zone.players.length < zone.maxCapacity) {
    zone.players.push(playerId);
    
    // Mettre à jour l'état du joueur
    const playerStateMap: Record<keyof TeamDugout['zones'], PlayerState> = {
      reserves: 'active',
      stunned: 'stunned',
      knockedOut: 'knocked_out',
      casualty: 'casualty',
      sentOff: 'sent_off'
    };
    
    player.state = playerStateMap[zoneType];
    
    // Si le joueur n'est pas en réserves, le retirer du terrain
    if (zoneType !== 'reserves') {
      player.pos = { x: -1, y: -1 }; // Position hors terrain
    }
  }

  return newState;
}

/**
 * Récupère tous les joueurs d'une zone de dugout
 */
export function getPlayersInDugoutZone(
  state: GameState,
  teamId: TeamId,
  zoneType: keyof TeamDugout['zones']
): Player[] {
  const dugout = state.dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
  const zone = dugout.zones[zoneType];
  
  return state.players.filter(player => 
    player.team === teamId && zone.players.includes(player.id)
  );
}

/**
 * Récupère tous les joueurs actifs (sur le terrain) d'une équipe
 */
export function getActivePlayers(state: GameState, teamId: TeamId): Player[] {
  return state.players.filter(player => 
    player.team === teamId && 
    player.state === 'active' && 
    player.pos.x >= 0 && 
    player.pos.y >= 0
  );
}

/**
 * Récupère tous les joueurs en réserves d'une équipe
 */
export function getReservePlayers(state: GameState, teamId: TeamId): Player[] {
  return getPlayersInDugoutZone(state, teamId, 'reserves');
}

/**
 * Récupère tous les joueurs KO d'une équipe
 */
export function getKnockedOutPlayers(state: GameState, teamId: TeamId): Player[] {
  return getPlayersInDugoutZone(state, teamId, 'knockedOut');
}

/**
 * Récupère tous les joueurs blessés d'une équipe
 */
export function getCasualtyPlayers(state: GameState, teamId: TeamId): Player[] {
  return getPlayersInDugoutZone(state, teamId, 'casualty');
}

/**
 * Récupère tous les joueurs exclus d'une équipe
 */
export function getSentOffPlayers(state: GameState, teamId: TeamId): Player[] {
  return getPlayersInDugoutZone(state, teamId, 'sentOff');
}

/**
 * Vérifie si un joueur peut être mis en jeu depuis les réserves
 */
export function canBringPlayerFromReserves(state: GameState, teamId: TeamId): boolean {
  const activePlayers = getActivePlayers(state, teamId);
  const reservePlayers = getReservePlayers(state, teamId);
  
  return activePlayers.length < 11 && reservePlayers.length > 0;
}

/**
 * Met un joueur en jeu depuis les réserves
 */
export function bringPlayerFromReserves(
  state: GameState,
  playerId: string,
  position: { x: number; y: number }
): GameState {
  const newState = structuredClone(state) as GameState;
  const player = newState.players.find(p => p.id === playerId);
  
  if (!player) return state;

  // Vérifier que le joueur est en réserves
  const teamId = player.team;
  const dugout = newState.dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
  const reservesZone = dugout.zones.reserves;
  
  if (!reservesZone.players.includes(playerId)) {
    return state; // Joueur pas en réserves
  }

  // Vérifier qu'il y a de la place sur le terrain
  const activePlayers = getActivePlayers(newState, teamId);
  if (activePlayers.length >= 11) {
    return state; // Trop de joueurs sur le terrain
  }

  // Retirer le joueur des réserves
  reservesZone.players = reservesZone.players.filter(id => id !== playerId);
  
  // Mettre le joueur sur le terrain
  player.pos = position;
  player.state = 'active';

  return newState;
}

/**
 * Gère la récupération des joueurs KO à la fin d'un drive
 */
export function recoverKnockedOutPlayers(state: GameState, teamId: TeamId, rng: () => number): GameState {
  const newState = structuredClone(state) as GameState;
  const knockedOutPlayers = getKnockedOutPlayers(newState, teamId);
  const dugout = newState.dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
  
  knockedOutPlayers.forEach(player => {
    // Jet de D6, 4+ pour récupérer
    const recoveryRoll = Math.floor(rng() * 6) + 1;
    
    if (recoveryRoll >= 4) {
      // Récupération réussie : aller en réserves
      dugout.zones.knockedOut.players = dugout.zones.knockedOut.players.filter(id => id !== player.id);
      dugout.zones.reserves.players.push(player.id);
      player.state = 'active';
    }
  });

  return newState;
}
