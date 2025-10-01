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
describe('Debug placement multiple', () => {
    it('devrait permettre de placer plusieurs joueurs', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        const legalPositions = setupState.preMatch.legalSetupPositions;
        console.log('Positions à utiliser:', [
            legalPositions[0], // (1, 0)
            legalPositions[15], // (2, 0) 
            legalPositions[30], // (3, 0)
            legalPositions[45] // (4, 0)
        ]);
        // Placer 4 joueurs
        let currentState = setupState;
        for (let i = 0; i < 4; i++) {
            const playerId = `A${i + 1}`;
            const pos = legalPositions[i * 15]; // Positions espacées
            console.log(`Placement ${playerId} sur:`, pos);
            const newState = placePlayerInSetup(currentState, playerId, pos);
            console.log('Résultat:', {
                success: newState !== currentState,
                placedPlayers: newState.preMatch.placedPlayers.length
            });
            expect(newState).not.toBe(currentState);
            currentState = newState;
        }
        expect(currentState.preMatch.placedPlayers.length).toBe(4);
    });
});
