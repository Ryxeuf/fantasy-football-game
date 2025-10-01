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
describe('Debug chevauchement', () => {
    it('devrait debugger pourquoi la vérification de chevauchement ne fonctionne pas', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        // Utiliser une position légale
        const pos = { x: 12, y: 0 };
        // Placer le premier joueur
        const playerId1 = 'A1';
        let currentState = placePlayerInSetup(setupState, playerId1, pos);
        console.log('Après placement A1:', {
            success: currentState !== setupState,
            placedPlayers: currentState.preMatch.placedPlayers,
            player1Pos: currentState.players.find(p => p.id === playerId1)?.pos
        });
        // Essayer de placer un deuxième joueur sur la même position
        const playerId2 = 'A2';
        console.log('Avant placement A2:', {
            player2CurrentPos: currentState.players.find(p => p.id === playerId2)?.pos,
            playersAtPos: currentState.players.filter(p => p.pos.x === pos.x && p.pos.y === pos.y)
        });
        const result = placePlayerInSetup(currentState, playerId2, pos);
        console.log('Après tentative placement A2:', {
            success: result !== currentState,
            placedPlayers: result.preMatch.placedPlayers,
            player2Pos: result.players.find(p => p.id === playerId2)?.pos,
            playersAtPos: result.players.filter(p => p.pos.x === pos.x && p.pos.y === pos.y)
        });
        // Le placement doit échouer
        expect(result).toBe(currentState);
    });
});
