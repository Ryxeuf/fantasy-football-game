import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams, enterSetupPhase, placePlayerInSetup, validatePlayerPlacement } from './game-state';
describe('Core Game Functions', () => {
    it('should create initial game state', () => {
        const state = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [
            { name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], 'Équipe A', 'Équipe B');
        expect(state).toBeDefined();
        expect(state.preMatch.phase).toBe('idle');
        expect(state.players).toHaveLength(2);
    });
    it('should enter setup phase', () => {
        const initialState = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [], 'Équipe A', 'Équipe B');
        const state = enterSetupPhase(initialState, 'A');
        expect(state.preMatch.phase).toBe('setup');
        expect(state.preMatch.currentCoach).toBe('A');
        expect(state.preMatch.legalSetupPositions.length).toBeGreaterThan(0);
    });
    it('should place player and return success object', () => {
        const initialState = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = enterSetupPhase(state, 'A');
        const result = placePlayerInSetup(state, state.players[0].id, { x: 12, y: 0 });
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.state).toBeDefined();
        expect(result.state.preMatch.placedPlayers).toContain(state.players[0].id);
    });
    it('should validate player placement and transition phases', () => {
        const initialState = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [
            { name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = enterSetupPhase(state, 'A');
        // Placer tous les joueurs de l'équipe A
        const teamAPlayers = state.players.filter(p => p.team === 'A');
        for (let i = 0; i < 11; i++) {
            const result = placePlayerInSetup(state, teamAPlayers[i].id, { x: 12, y: i });
            expect(result.success).toBe(true);
            state = result.state;
        }
        // Valider le placement
        const validatedState = validatePlayerPlacement(state);
        expect(validatedState.preMatch.currentCoach).toBe('B');
        expect(validatedState.preMatch.placedPlayers).toHaveLength(0);
        expect(validatedState.preMatch.phase).toBe('setup');
    });
});
