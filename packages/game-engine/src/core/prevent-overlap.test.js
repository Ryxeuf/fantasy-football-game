import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams, enterSetupPhase, placePlayerInSetup, } from './game-state';
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
describe('Prévention des chevauchements de joueurs', () => {
    it('devrait empêcher de placer deux joueurs sur la même case', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        // Utiliser une position légale
        const pos = { x: 12, y: 0 };
        // Placer le premier joueur
        const playerId1 = 'A1';
        let currentState = placePlayerInSetup(setupState, playerId1, pos);
        expect(currentState).not.toBe(setupState);
        expect(currentState.preMatch.placedPlayers.length).toBe(1);
        // Essayer de placer un deuxième joueur sur la même position
        const playerId2 = 'A2';
        const result = placePlayerInSetup(currentState, playerId2, pos);
        // Le placement doit échouer (retourner le même état)
        expect(result).toBe(currentState);
        expect(result.preMatch.placedPlayers.length).toBe(1); // Toujours 1 joueur
    });
    it('devrait permettre de repositionner un joueur sur une case libre', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        const legalPositions = setupState.preMatch.legalSetupPositions;
        const pos1 = legalPositions[0];
        const pos2 = legalPositions[1];
        // Placer le premier joueur
        const playerId = 'A1';
        let currentState = placePlayerInSetup(setupState, playerId, pos1);
        expect(currentState.preMatch.placedPlayers.length).toBe(1);
        // Repositionner le joueur sur une autre position libre
        const result = placePlayerInSetup(currentState, playerId, pos2);
        expect(result).not.toBe(currentState);
        expect(result.preMatch.placedPlayers.length).toBe(1); // Toujours 1 joueur
        expect(result.players.find(p => p.id === playerId)?.pos).toEqual(pos2);
    });
    it('devrait permettre de placer deux joueurs sur des positions différentes', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        const legalPositions = setupState.preMatch.legalSetupPositions;
        const pos1 = legalPositions[0];
        const pos2 = legalPositions[1];
        // Placer le premier joueur
        const playerId1 = 'A1';
        let currentState = placePlayerInSetup(setupState, playerId1, pos1);
        expect(currentState.preMatch.placedPlayers.length).toBe(1);
        // Placer le deuxième joueur sur une position différente
        const playerId2 = 'A2';
        const result = placePlayerInSetup(currentState, playerId2, pos2);
        expect(result).not.toBe(currentState);
        expect(result.preMatch.placedPlayers.length).toBe(2); // Maintenant 2 joueurs
    });
});
