import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams, enterSetupPhase, placePlayerInSetup } from './game-state';
describe('PlacePlayerInSetup Return Format', () => {
    it('should return { success: boolean, state: ExtendedGameState }', () => {
        // Créer un état initial avec des équipes
        const initialState = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = enterSetupPhase(state, 'A');
        // Essayer de placer un joueur
        const teamAPlayers = state.players.filter(p => p.team === 'A');
        const result = placePlayerInSetup(state, teamAPlayers[0].id, { x: 12, y: 0 });
        // Vérifier le format de retour
        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('state');
        expect(typeof result.success).toBe('boolean');
        expect(result.state).toHaveProperty('preMatch');
        expect(result.state.preMatch).toHaveProperty('placedPlayers');
        // Vérifier que le placement a réussi
        expect(result.success).toBe(true);
        expect(result.state.preMatch.placedPlayers).toContain(teamAPlayers[0].id);
    });
    it('should return success: false for invalid placement', () => {
        const initialState = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = enterSetupPhase(state, 'A');
        // Essayer de placer un joueur sur une position invalide
        const teamAPlayers = state.players.filter(p => p.team === 'A');
        const result = placePlayerInSetup(state, teamAPlayers[0].id, { x: 30, y: 0 }); // Position hors terrain
        // Vérifier que le placement a échoué
        expect(result.success).toBe(false);
        expect(result.state).toBe(state); // L'état ne doit pas changer
    });
});
