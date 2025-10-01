import { describe, it } from 'vitest';
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
describe('Test positions légales', () => {
    it('devrait tester différentes positions', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        console.log('Positions légales:', setupState.preMatch.legalSetupPositions.slice(0, 20));
        // Tester différentes positions
        const positionsToTest = [
            { x: 1, y: 0 },
            { x: 1, y: 7 },
            { x: 6, y: 7 },
            { x: 12, y: 7 },
            { x: 20, y: 7 },
        ];
        const playerId = 'A1';
        for (const pos of positionsToTest) {
            const isLegal = setupState.preMatch.legalSetupPositions.some(l => l.x === pos.x && l.y === pos.y);
            const result = placePlayerInSetup(setupState, playerId, pos);
            const success = result !== setupState;
            console.log(`Position ${pos.x},${pos.y}: légal=${isLegal}, succès=${success}`);
        }
    });
});
