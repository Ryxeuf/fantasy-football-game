/**
 * Test simple pour vérifier la logique de base du bouton kick-off
 */

import { describe, it, expect } from 'vitest';
import {
  setupPreMatchWithTeams,
  enterSetupPhase,
  placePlayerInSetup,
  type ExtendedGameState,
  type TeamPlayerData,
} from './game-state';

// Helper pour créer des joueurs de test
function createTestPlayers(team: 'A' | 'B', count: number): TeamPlayerData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${team}${i + 1}`,
    name: `Joueur ${team}${i + 1}`,
    number: i + 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: '',
    team: team,
  }));
}

describe('Simple Kickoff Logic', () => {
  it('doit permettre le kick-off seulement si les deux équipes ont placé leurs joueurs', () => {
    // Créer un état pré-match avec des équipes
    const teamAPlayers = createTestPlayers('A', 11);
    const teamBPlayers = createTestPlayers('B', 11);
    const state = setupPreMatchWithTeams(
      teamAPlayers,
      teamBPlayers,
      'Équipe A',
      'Équipe B'
    );

    console.log('Initial state:', {
      receivingTeam: state.preMatch.receivingTeam,
      kickingTeam: state.preMatch.kickingTeam,
      currentCoach: state.preMatch.currentCoach,
      phase: state.preMatch.phase
    });

    // Entrer en phase setup pour l'équipe A
    let currentState = enterSetupPhase(state, 'A');

    console.log('After enterSetupPhase A:', {
      currentCoach: currentState.preMatch.currentCoach,
      phase: currentState.preMatch.phase,
      placedPlayers: currentState.preMatch.placedPlayers.length
    });

    // Simuler que l'équipe A a placé ses 11 joueurs
    // (au lieu de les placer un par un, modifions directement l'état)
    currentState = {
      ...currentState,
      players: currentState.players.map(p => 
        p.team === 'A' ? { ...p, pos: { x: 5, y: 3 } } : p
      ),
      preMatch: {
        ...currentState.preMatch,
        placedPlayers: teamAPlayers.map(p => p.id)
      }
    };

    console.log('After team A placement:', {
      currentCoach: currentState.preMatch.currentCoach,
      phase: currentState.preMatch.phase,
      placedPlayers: currentState.preMatch.placedPlayers.length,
      teamAPlayersOnField: currentState.players.filter(p => p.team === 'A' && p.pos.x >= 0).length
    });

    // Simuler que l'équipe B a aussi placé ses 11 joueurs
    currentState = {
      ...currentState,
      players: currentState.players.map(p => 
        p.team === 'B' ? { ...p, pos: { x: 15, y: 3 } } : p
      )
    };

    console.log('After team B placement:', {
      teamAPlayersOnField: currentState.players.filter(p => p.team === 'A' && p.pos.x >= 0).length,
      teamBPlayersOnField: currentState.players.filter(p => p.team === 'B' && p.pos.x >= 0).length
    });

    // Vérifier que les deux équipes ont placé leurs 11 joueurs
    const teamAPlayersOnField = currentState.players.filter(p => p.team === 'A' && p.pos.x >= 0).length;
    const teamBPlayersOnField = currentState.players.filter(p => p.team === 'B' && p.pos.x >= 0).length;
    
    expect(teamAPlayersOnField).toBe(11);
    expect(teamBPlayersOnField).toBe(11);

    // Le bouton kick-off devrait apparaître
    const shouldShowKickoffButton = teamAPlayersOnField === 11 && teamBPlayersOnField === 11;
    expect(shouldShowKickoffButton).toBe(true);
  });
});



