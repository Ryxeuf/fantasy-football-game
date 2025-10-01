import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams, enterSetupPhase, placePlayerInSetup } from './game-state';
// Créer des données de joueurs de test
const createTestPlayers = (teamPrefix, count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${teamPrefix}${i + 1}`,
    name: `Joueur ${teamPrefix}${i + 1}`,
    position: 'Lineman',
    number: i + 1,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: '',
  }));
};
describe('Debug setup LOS', () => {
  it('devrait créer des joueurs et permettre le placement', () => {
    const teamAData = createTestPlayers('A', 11);
    const teamBData = createTestPlayers('B', 11);
    const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
    const setupState = enterSetupPhase(state, 'A');
    // Utiliser une position qui est dans les positions légales
    const playerId = 'A1';
    const pos = { x: 12, y: 0 }; // Position légale d'après le debug
    // Debug des conditions
    const player = setupState.players.find(p => p.id === playerId);
    console.log('Debug conditions:', {
      phase: setupState.preMatch.phase,
      currentCoach: setupState.preMatch.currentCoach,
      playerTeam: player?.team,
      playerPos: player?.pos,
      isLegalPosition: setupState.preMatch.legalSetupPositions.some(
        l => l.x === pos.x && l.y === pos.y
      ),
      legalPositions: setupState.preMatch.legalSetupPositions.slice(0, 5), // Premières 5 positions
    });
    const result = placePlayerInSetup(setupState, playerId, pos);
    console.log('Résultat placement:', {
      success: result !== setupState,
      placedPlayers: result.preMatch.placedPlayers.length,
      playerPos: result.players.find(p => p.id === playerId)?.pos,
    });
    expect(result).not.toBe(setupState);
    expect(result.preMatch.placedPlayers.length).toBe(1);
  });
});
