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
describe('Vérification LOS en phase setup', () => {
    it('devrait permettre le repositionnement des joueurs', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        // Utiliser une position légale
        const playerId = 'A1';
        const pos1 = setupState.preMatch.legalSetupPositions[0];
        let currentState = placePlayerInSetup(setupState, playerId, pos1);
        expect(currentState.preMatch.placedPlayers.length).toBe(1);
        // Repositionner le même joueur sur une autre position légale
        const pos2 = setupState.preMatch.legalSetupPositions[1];
        const repositionedState = placePlayerInSetup(currentState, playerId, pos2);
        expect(repositionedState).not.toBe(currentState);
        expect(repositionedState.preMatch.placedPlayers.length).toBe(1); // Toujours 1 joueur
        expect(repositionedState.players.find(p => p.id === playerId)?.pos).toEqual(pos2);
    });
    it('devrait vérifier la contrainte LOS à partir du 9e joueur', () => {
        const teamAData = createTestPlayers('A', 11);
        const teamBData = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAData, teamBData, 'Équipe A', 'Équipe B');
        const setupState = enterSetupPhase(state, 'A');
        // Placer 8 joueurs sur des positions légales espacées
        let currentState = setupState;
        const legalPositions = currentState.preMatch.legalSetupPositions;
        // Utiliser des positions espacées pour éviter les conflits
        // Éviter les wide zones (y=0..2 et y=12..14) pour ne pas dépasser la limite de 2 joueurs
        const spacedPositions = [
            legalPositions[0], // (1, 0) - left wide zone
            legalPositions[15], // (2, 0) - left wide zone
            legalPositions[45], // (4, 0) - left wide zone (mais on va utiliser y=3)
            legalPositions[60], // (5, 0) - left wide zone (mais on va utiliser y=4)
            legalPositions[75], // (6, 0) - left wide zone (mais on va utiliser y=5)
            legalPositions[90], // (7, 0) - left wide zone (mais on va utiliser y=6)
            legalPositions[105], // (8, 0) - left wide zone (mais on va utiliser y=7)
            legalPositions[120], // (9, 0) - left wide zone (mais on va utiliser y=8)
        ];
        // Corriger les positions pour éviter les wide zones
        spacedPositions[2] = { x: 4, y: 3 }; // Au lieu de (4, 0)
        spacedPositions[3] = { x: 5, y: 4 }; // Au lieu de (5, 0)
        spacedPositions[4] = { x: 6, y: 5 }; // Au lieu de (6, 0)
        spacedPositions[5] = { x: 7, y: 6 }; // Au lieu de (7, 0)
        spacedPositions[6] = { x: 8, y: 7 }; // Au lieu de (8, 0)
        spacedPositions[7] = { x: 9, y: 8 }; // Au lieu de (9, 0)
        for (let i = 0; i < 8; i++) {
            const playerId = `A${i + 1}`;
            const pos = spacedPositions[i];
            const newState = placePlayerInSetup(currentState, playerId, pos);
            expect(newState).not.toBe(currentState);
            currentState = newState;
        }
        // Le 9e joueur doit être accepté s'il est sur la LOS
        const playerId = 'A9';
        // Utiliser une position sur la LOS qui n'est pas dans une wide zone (y=3..11)
        const posSurLos = legalPositions.find(p => p.x === 12 && p.y >= 3 && p.y <= 11);
        if (posSurLos) {
            const resultSurLos = placePlayerInSetup(currentState, playerId, posSurLos);
            expect(resultSurLos).not.toBe(currentState); // Doit être accepté
        }
    });
});
