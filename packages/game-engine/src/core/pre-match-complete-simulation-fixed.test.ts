import { describe, it, expect } from 'vitest';
import { createInitialGameState, enterSetupPhase, placePlayerInSetup, ExtendedGameState } from '../game-state';

describe('Pre-Match Phase Complete Simulation', () => {
  it('should simulate complete pre-match phase with both teams', () => {
    // Créer un état initial avec les deux équipes
    const initialState = createInitialGameState({
      teamA: 'Équipe A',
      teamB: 'Équipe B',
      players: [
        // Équipe A - 11 joueurs
        { id: 'A1', team: 'A', name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A2', team: 'A', name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A3', team: 'A', name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A4', team: 'A', name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A5', team: 'A', name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A6', team: 'A', name: 'Joueur A6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A7', team: 'A', name: 'Joueur A7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A8', team: 'A', name: 'Joueur A8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A9', team: 'A', name: 'Joueur A9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A10', team: 'A', name: 'Joueur A10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A11', team: 'A', name: 'Joueur A11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        // Équipe B - 11 joueurs
        { id: 'B1', team: 'B', name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B2', team: 'B', name: 'Joueur B2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B3', team: 'B', name: 'Joueur B3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B4', team: 'B', name: 'Joueur B4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B5', team: 'B', name: 'Joueur B5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B6', team: 'B', name: 'Joueur B6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B7', team: 'B', name: 'Joueur B7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B8', team: 'B', name: 'Joueur B8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B9', team: 'B', name: 'Joueur B9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B10', team: 'B', name: 'Joueur B10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'B11', team: 'B', name: 'Joueur B11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
      ]
    });

    let state = initialState as ExtendedGameState;

    // === PHASE 1: Équipe A place ses joueurs ===
    console.log('=== PHASE 1: Équipe A place ses joueurs ===');
    
    // Entrer en phase setup pour l'équipe A
    state = enterSetupPhase(state, 'A');
    expect(state.preMatch.phase).toBe('setup');
    expect(state.preMatch.currentCoach).toBe('A');

    // Placer les 11 joueurs de l'équipe A
    const teamAPositions = [
      // 3 joueurs sur la LOS (y=0)
      { x: 12, y: 0 }, { x: 13, y: 0 }, { x: 14, y: 0 },
      // 8 joueurs ailleurs
      { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
      { x: 12, y: 7 }, { x: 13, y: 7 }, { x: 14, y: 7 },
      { x: 12, y: 8 }, { x: 13, y: 8 }
    ];

    for (let i = 0; i < 11; i++) {
      const playerId = `A${i + 1}`;
      const position = teamAPositions[i];
      
      const result = placePlayerInSetup(state, playerId, position);
      expect(result.success).toBe(true);
      state = result.state;
      
      console.log(`After placing ${playerId}: placedPlayers = ${state.preMatch.placedPlayers.length}`);
      
      // Vérifier que le joueur est bien placé
      const player = state.players.find(p => p.id === playerId);
      expect(player?.pos.x).toBe(position.x);
      expect(player?.pos.y).toBe(position.y);
    }
    
    expect(state.preMatch.placedPlayers).toHaveLength(11);
    expect(state.preMatch.currentCoach).toBe('B'); // Doit passer à l'équipe B
    
    // === PHASE 2: Équipe B place ses joueurs ===
    console.log('=== PHASE 2: Équipe B place ses joueurs ===');
    
    // L'équipe B devrait maintenant être active
    expect(state.preMatch.phase).toBe('setup');
    expect(state.preMatch.currentCoach).toBe('B');
    
    // Placer les 11 joueurs de l'équipe B
    const teamBPositions = [
      // 3 joueurs sur la LOS (y=0)
      { x: 12, y: 0 }, { x: 13, y: 0 }, { x: 14, y: 0 },
      // 8 joueurs ailleurs
      { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
      { x: 12, y: 7 }, { x: 13, y: 7 }, { x: 14, y: 7 },
      { x: 12, y: 8 }, { x: 13, y: 8 }
    ];

    for (let i = 0; i < 11; i++) {
      const playerId = `B${i + 1}`;
      const position = teamBPositions[i];
      
      const result = placePlayerInSetup(state, playerId, position);
      expect(result.success).toBe(true);
      state = result.state;
    }
    
    // Après avoir placé tous les joueurs, on devrait être en phase kickoff
    expect(state.preMatch.phase).toBe('kickoff');
    
    // Vérifier que tous les joueurs sont bien placés
    const teamAPlayersOnField = state.players.filter(p => p.team === 'A' && p.pos.x >= 0).length;
    const teamBPlayersOnField = state.players.filter(p => p.team === 'B' && p.pos.x >= 0).length;
    
    expect(teamAPlayersOnField).toBe(11);
    expect(teamBPlayersOnField).toBe(11);
  });

  it('should handle repositioning during setup phase', () => {
    const initialState = createInitialGameState({
      teamA: 'Équipe A',
      teamB: 'Équipe B',
      players: [
        { id: 'A1', team: 'A', name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A2', team: 'A', name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
        { id: 'A3', team: 'A', name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
      ]
    });

    let state = initialState as ExtendedGameState;
    state = enterSetupPhase(state, 'A');

    // Placer A1
    const result1 = placePlayerInSetup(state, 'A1', { x: 12, y: 0 });
    expect(result1.success).toBe(true);
    state = result1.state;

    // Placer A2
    const result2 = placePlayerInSetup(state, 'A2', { x: 13, y: 0 });
    expect(result2.success).toBe(true);
    state = result2.state;

    // Placer A3
    const result3 = placePlayerInSetup(state, 'A3', { x: 14, y: 0 });
    expect(result3.success).toBe(true);
    state = result3.state;
    
    expect(state.preMatch.placedPlayers).toHaveLength(3);
    
    // Repositionner A1
    const resultRepos = placePlayerInSetup(state, 'A1', { x: 15, y: 0 });
    expect(resultRepos.success).toBe(true);
    state = resultRepos.state;
    
    // Vérifier que A1 a été repositionné
    const playerA1 = state.players.find(p => p.id === 'A1');
    expect(playerA1?.pos.x).toBe(15);
    expect(playerA1?.pos.y).toBe(0);
    
    // Le nombre de joueurs placés ne devrait pas changer
    expect(state.preMatch.placedPlayers).toHaveLength(3);
  });

  it('should validate LOS constraint during placement', () => {
    const initialState = createInitialGameState({
      teamA: 'Équipe A',
      teamB: 'Équipe B',
      players: Array.from({ length: 11 }, (_, i) => ({
        id: `A${i + 1}`,
        team: 'A',
        name: `Joueur A${i + 1}`,
        number: i + 1,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: []
      }))
    });

    let state = initialState as ExtendedGameState;
    state = enterSetupPhase(state, 'A');
    
    // Placer 8 joueurs sans respecter la LOS
    for (let i = 0; i < 8; i++) {
      const result = placePlayerInSetup(state, `A${i + 1}`, { x: 12, y: 3 + i });
      expect(result.success).toBe(true);
      state = result.state;
    }
    
    // Au 9ème joueur, on devrait pouvoir placer sans problème
    const result9 = placePlayerInSetup(state, 'A9', { x: 12, y: 0 });
    expect(result9.success).toBe(true);
    state = result9.state;
    
    // Au 10ème joueur, on devrait pouvoir placer sans problème
    const result10 = placePlayerInSetup(state, 'A10', { x: 13, y: 0 });
    expect(result10.success).toBe(true);
    state = result10.state;
    
    // Au 11ème joueur, on devrait pouvoir placer sans problème
    const result11 = placePlayerInSetup(state, 'A11', { x: 14, y: 0 });
    expect(result11.success).toBe(true);
    state = result11.state;
    
    // Vérifier qu'on a bien 3 joueurs sur la LOS
    const losPlayers = state.players.filter(p => p.team === 'A' && (p.pos.x === 12 || p.pos.x === 13 || p.pos.x === 14) && p.pos.y === 0);
    expect(losPlayers).toHaveLength(3);
  });

  it('should handle validation button logic correctly', () => {
    const initialState = createInitialGameState({
      teamA: 'Équipe A',
      teamB: 'Équipe B',
      players: Array.from({ length: 11 }, (_, i) => ({
        id: `A${i + 1}`,
        team: 'A',
        name: `Joueur A${i + 1}`,
        number: i + 1,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: []
      }))
    });

    let state = initialState as ExtendedGameState;
    state = enterSetupPhase(state, 'A');

    // Placer tous les joueurs de l'équipe A
    const positions = [
      { x: 12, y: 0 }, { x: 13, y: 0 }, { x: 14, y: 0 },
      { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
      { x: 12, y: 7 }, { x: 13, y: 7 }, { x: 14, y: 7 },
      { x: 12, y: 8 }, { x: 13, y: 8 }
    ];

    for (let i = 0; i < 11; i++) {
      const result = placePlayerInSetup(state, `A${i + 1}`, positions[i]);
      expect(result.success).toBe(true);
      state = result.state;
    }

    // Après avoir placé 11 joueurs, on devrait passer à l'équipe B
    expect(state.preMatch.currentCoach).toBe('B');
    expect(state.preMatch.placedPlayers).toHaveLength(11);
  });
});
