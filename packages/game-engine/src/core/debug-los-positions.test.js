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
describe('Debug positions LOS', () => {
  it('devrait debugger les positions légales', () => {
    const teamAData = createTestPlayers('A', 11);
    const teamBData = createTestPlayers('B', 11);
    const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
    const setupState = enterSetupPhase(state, 'A');
    console.log(
      'Premières positions légales:',
      setupState.preMatch.legalSetupPositions.slice(0, 20)
    );
    // Essayer de placer le premier joueur
    const playerId = 'A1';
    const pos = setupState.preMatch.legalSetupPositions[0];
    console.log('Tentative placement A1 sur:', pos);
    const result = placePlayerInSetup(setupState, playerId, pos);
    console.log('Résultat:', {
      success: result !== setupState,
      placedPlayers: result.preMatch.placedPlayers.length,
      playerPos: result.players.find(p => p.id === playerId)?.pos,
    });
    expect(result).not.toBe(setupState);
  });
});
