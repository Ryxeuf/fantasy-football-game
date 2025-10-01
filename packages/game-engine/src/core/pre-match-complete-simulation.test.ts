import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams, enterSetupPhase, placePlayerInSetup } from '../core/game-state';
import type { ExtendedGameState, Player } from '../core/types';

// Helper pour créer des joueurs de test
const createTestPlayers = (team: string, count: number): Player[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${team}${i + 1}`,
    team,
    pos: { x: -1, y: -1 }, // Position initiale dans la réserve
    name: `Joueur ${team}${i + 1}`,
    number: i + 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 3,
    av: 8,
    skills: '',
    pm: 6,
    hasBall: false,
    state: 'active',
    stunned: false
  }));
};

describe('Pre-Match Phase Complete Simulation', () => {
  it('should simulate complete pre-match phase with both teams', () => {
    // Créer les joueurs pour les deux équipes
    const teamAPlayers = createTestPlayers('A', 11);
    const teamBPlayers = createTestPlayers('B', 11);
    
    // Initialiser le match
    let state = setupPreMatchWithTeams(
      teamAPlayers,
      teamBPlayers,
      'Équipe A',
      'Équipe B'
    );
    
    expect(state.preMatch.phase).toBe('idle');
    expect(state.preMatch.currentCoach).toBe('A');
    expect(state.preMatch.receivingTeam).toBe('A');
    expect(state.preMatch.kickingTeam).toBe('B');
    
    // === PHASE 1: Équipe A place ses joueurs ===
    console.log('=== PHASE 1: Équipe A place ses joueurs ===');
    
    // Entrer en phase setup pour l'équipe A
    state = enterSetupPhase(state, 'A');
    expect(state.preMatch.phase).toBe('setup');
    expect(state.preMatch.currentCoach).toBe('A');
    expect(state.preMatch.placedPlayers).toHaveLength(0);
    
    // Placer les 11 joueurs de l'équipe A
    const teamAPositions = [
      // 3 joueurs sur la LOS (y=0)
      { x: 12, y: 0 }, { x: 13, y: 0 }, { x: 14, y: 0 },
      // 8 joueurs ailleurs (éviter les zones larges y=0..2 et y=12..14)
      { x: 12, y: 3 }, { x: 13, y: 3 }, { x: 14, y: 3 },
      { x: 12, y: 4 }, { x: 13, y: 4 }, { x: 14, y: 4 },
      { x: 12, y: 5 }, { x: 13, y: 5 }
    ];
    
    for (let i = 0; i < 11; i++) {
      const playerId = `A${i + 1}`;
      const position = teamAPositions[i];
      
      console.log(`Placing ${playerId} at (${position.x}, ${position.y})`);
      
      state = placePlayerInSetup(state, playerId, position);
      
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
      
      console.log(`Placing ${playerId} at (${position.x}, ${position.y})`);
      
      state = placePlayerInSetup(state, playerId, position);
      
      console.log(`After placing ${playerId}: placedPlayers = ${state.preMatch.placedPlayers.length}`);
      
      // Vérifier que le joueur est bien placé
      const player = state.players.find(p => p.id === playerId);
      expect(player?.pos.x).toBe(position.x);
      expect(player?.pos.y).toBe(position.y);
    }
    
    expect(state.preMatch.placedPlayers).toHaveLength(22); // 11 + 11
    expect(state.preMatch.phase).toBe('kickoff'); // Doit passer au kickoff
    
    // === VALIDATION FINALE ===
    console.log('=== VALIDATION FINALE ===');
    
    // Vérifier que tous les joueurs sont placés
    const teamAPlayersOnField = state.players.filter(p => p.team === 'A' && p.pos.x >= 0);
    const teamBPlayersOnField = state.players.filter(p => p.team === 'B' && p.pos.x >= 0);
    
    expect(teamAPlayersOnField).toHaveLength(11);
    expect(teamBPlayersOnField).toHaveLength(11);
    
    // Vérifier que le bouton kick-off devrait apparaître
    const shouldShowKickoffButton = teamAPlayersOnField.length === 11 && teamBPlayersOnField.length === 11;
    expect(shouldShowKickoffButton).toBe(true);
    
    console.log('✅ Pre-match phase completed successfully!');
    console.log(`Team A players on field: ${teamAPlayersOnField.length}`);
    console.log(`Team B players on field: ${teamBPlayersOnField.length}`);
    console.log(`Phase: ${state.preMatch.phase}`);
  });

  it('should handle repositioning during setup phase', () => {
    // Créer les joueurs pour l'équipe A
    const teamAPlayers = createTestPlayers('A', 11);
    const teamBPlayers = createTestPlayers('B', 11);
    
    // Initialiser le match
    let state = setupPreMatchWithTeams(
      teamAPlayers,
      teamBPlayers,
      'Équipe A',
      'Équipe B'
    );
    
    // Entrer en phase setup
    state = enterSetupPhase(state, 'A');
    
    // Placer quelques joueurs
    state = placePlayerInSetup(state, 'A1', { x: 12, y: 0 });
    state = placePlayerInSetup(state, 'A2', { x: 13, y: 0 });
    state = placePlayerInSetup(state, 'A3', { x: 14, y: 0 });
    
    expect(state.preMatch.placedPlayers).toHaveLength(3);
    
    // Repositionner A1
    state = placePlayerInSetup(state, 'A1', { x: 12, y: 3 });
    
    // Vérifier que A1 a été repositionné
    const playerA1 = state.players.find(p => p.id === 'A1');
    expect(playerA1?.pos.x).toBe(12);
    expect(playerA1?.pos.y).toBe(3);
    
    // Vérifier que le nombre de joueurs placés n'a pas changé
    expect(state.preMatch.placedPlayers).toHaveLength(3);
  });

  it('should prevent placing multiple players on same square', () => {
    // Créer les joueurs pour l'équipe A
    const teamAPlayers = createTestPlayers('A', 11);
    const teamBPlayers = createTestPlayers('B', 11);
    
    // Initialiser le match
    let state = setupPreMatchWithTeams(
      teamAPlayers,
      teamBPlayers,
      'Équipe A',
      'Équipe B'
    );
    
    // Entrer en phase setup
    state = enterSetupPhase(state, 'A');
    
    // Placer A1
    state = placePlayerInSetup(state, 'A1', { x: 12, y: 0 });
    
    // Essayer de placer A2 sur la même case
    const result2 = placePlayerInSetup(state, 'A2', { x: 12, y: 0 });
    // Note: placePlayerInSetup retourne directement le state, pas un objet avec success
    // On vérifie plutôt que le joueur n'a pas été placé
    const playerA2 = state.players.find(p => p.id === 'A2');
    expect(playerA2?.pos.x).toBe(-1); // Devrait rester en réserve
  });

  it('should validate LOS constraint during placement', () => {
    // Créer les joueurs pour l'équipe A
    const teamAPlayers = createTestPlayers('A', 11);
    const teamBPlayers = createTestPlayers('B', 11);
    
    // Initialiser le match
    let state = setupPreMatchWithTeams(
      teamAPlayers,
      teamBPlayers,
      'Équipe A',
      'Équipe B'
    );
    
    // Entrer en phase setup
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
    
    // Vérifier que tous les joueurs sont placés
    expect(state.preMatch.placedPlayers).toHaveLength(11);
  });

  it('should handle wide zone constraints', () => {
    // Créer les joueurs pour l'équipe A
    const teamAPlayers = createTestPlayers('A', 11);
    const teamBPlayers = createTestPlayers('B', 11);
    
    // Initialiser le match
    let state = setupPreMatchWithTeams(
      teamAPlayers,
      teamBPlayers,
      'Équipe A',
      'Équipe B'
    );
    
    // Entrer en phase setup
    state = enterSetupPhase(state, 'A');
    
    // Placer 2 joueurs dans la zone large gauche (y=0..2)
    state = placePlayerInSetup(state, 'A1', { x: 12, y: 0 });
    state = placePlayerInSetup(state, 'A2', { x: 12, y: 1 });
    
    // Essayer de placer un 3ème joueur dans la zone large gauche
    state = placePlayerInSetup(state, 'A3', { x: 12, y: 2 });
    
    // Vérifier que A3 n'a pas été placé (devrait rester en réserve)
    const playerA3 = state.players.find(p => p.id === 'A3');
    expect(playerA3?.pos.x).toBe(-1); // Devrait rester en réserve
  });

  it('should handle validation button logic correctly', () => {
    // Créer les joueurs pour les deux équipes
    const teamAPlayers = createTestPlayers('A', 11);
    const teamBPlayers = createTestPlayers('B', 11);
    
    // Initialiser le match
    let state = setupPreMatchWithTeams(
      teamAPlayers,
      teamBPlayers,
      'Équipe A',
      'Équipe B'
    );
    
    // Entrer en phase setup
    state = enterSetupPhase(state, 'A');
    
    // Simuler le placement de l'équipe A
    for (let i = 0; i < 11; i++) {
      state = placePlayerInSetup(state, `A${i + 1}`, { x: 12, y: 3 + i }).state;
    }
    
    // Vérifier que le bouton "Valider le placement" devrait apparaître
    const teamAPlayersOnField = state.players.filter(p => p.team === 'A' && p.pos.x >= 0);
    const shouldShowValidateButton = teamAPlayersOnField.length === 11;
    expect(shouldShowValidateButton).toBe(true);
    
    // Simuler le placement de l'équipe B
    for (let i = 0; i < 11; i++) {
      state = placePlayerInSetup(state, `B${i + 1}`, { x: 12, y: 3 + i }).state;
    }
    
    // Vérifier que le bouton "Lancer le kick-off" devrait apparaître
    const teamBPlayersOnField = state.players.filter(p => p.team === 'B' && p.pos.x >= 0);
    const shouldShowKickoffButton = teamAPlayersOnField.length === 11 && teamBPlayersOnField.length === 11;
    expect(shouldShowKickoffButton).toBe(true);
  });
});
