import { describe, it, expect } from 'vitest';
import { shouldAutoEndTurn } from '../core/game-state';
import { getLegalMoves as getLegalMovesFromActions } from '../actions/actions';
// Helper pour créer un état de jeu minimal
const createMinimalGameState = (overrides = {}) => ({
    players: [],
    currentPlayer: 'A',
    selectedPlayerId: null,
    isTurnover: false,
    half: 1,
    turn: 1,
    teamNames: {
        teamA: 'Équipe A',
        teamB: 'Équipe B'
    },
    gameLog: [],
    ball: null,
    lastDiceResult: undefined,
    playerActions: new Map(),
    teamBlitzCount: new Map(),
    dugouts: {
        teamA: {
            zones: {
                reserves: { players: [] },
                ko: { players: [] },
                stunned: { players: [] },
                injured: { players: [] }
            }
        },
        teamB: {
            zones: {
                reserves: { players: [] },
                ko: { players: [] },
                stunned: { players: [] },
                injured: { players: [] }
            }
        }
    },
    preMatch: {
        phase: 'idle',
        currentCoach: 'A',
        receivingTeam: 'A',
        kickingTeam: 'B',
        legalSetupPositions: [],
        placedPlayers: []
    },
    ...overrides
});
describe('Game Engine Safety Tests', () => {
    describe('shouldAutoEndTurn', () => {
        it('should handle undefined players gracefully', () => {
            const state = createMinimalGameState({ players: undefined });
            const result = shouldAutoEndTurn(state);
            expect(result).toBe(false);
        });
        it('should handle null players gracefully', () => {
            const state = createMinimalGameState({ players: null });
            const result = shouldAutoEndTurn(state);
            expect(result).toBe(false);
        });
        it('should handle non-array players gracefully', () => {
            const state = createMinimalGameState({ players: 'not-an-array' });
            const result = shouldAutoEndTurn(state);
            expect(result).toBe(false);
        });
        it('should work with empty players array', () => {
            const state = createMinimalGameState({ players: [] });
            const result = shouldAutoEndTurn(state);
            expect(result).toBe(true); // Empty team means all players have "acted"
        });
        it('should work with valid players array', () => {
            const state = createMinimalGameState({
                players: [
                    {
                        id: 'A1',
                        team: 'A',
                        pos: { x: 0, y: 0 },
                        name: 'Player A1',
                        number: 1,
                        position: 'Lineman',
                        ma: 6,
                        st: 3,
                        ag: 3,
                        pa: 3,
                        av: 8,
                        skills: [],
                        pm: 6,
                        hasBall: false,
                        state: 'active',
                        stunned: false
                    }
                ]
            });
            const result = shouldAutoEndTurn(state);
            expect(typeof result).toBe('boolean');
        });
    });
    describe('getLegalMoves', () => {
        it('should handle undefined players gracefully', () => {
            const state = createMinimalGameState({ players: undefined });
            const result = getLegalMovesFromActions(state);
            expect(result).toEqual([{ type: 'END_TURN' }]);
        });
        it('should handle null players gracefully', () => {
            const state = createMinimalGameState({ players: null });
            const result = getLegalMovesFromActions(state);
            expect(result).toEqual([{ type: 'END_TURN' }]);
        });
        it('should handle non-array players gracefully', () => {
            const state = createMinimalGameState({ players: 'not-an-array' });
            const result = getLegalMovesFromActions(state);
            expect(result).toEqual([{ type: 'END_TURN' }]);
        });
        it('should work with empty players array', () => {
            const state = createMinimalGameState({ players: [] });
            const result = getLegalMovesFromActions(state);
            expect(result).toEqual([{ type: 'END_TURN' }]);
        });
        it('should work with valid players array', () => {
            const state = createMinimalGameState({
                players: [
                    {
                        id: 'A1',
                        team: 'A',
                        pos: { x: 0, y: 0 },
                        name: 'Player A1',
                        number: 1,
                        position: 'Lineman',
                        ma: 6,
                        st: 3,
                        ag: 3,
                        pa: 3,
                        av: 8,
                        skills: [],
                        pm: 6,
                        hasBall: false,
                        state: 'active',
                        stunned: false
                    }
                ]
            });
            const result = getLegalMovesFromActions(state);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        it('should return END_TURN when turnover', () => {
            const state = createMinimalGameState({ isTurnover: true });
            const result = getLegalMovesFromActions(state);
            expect(result).toEqual([{ type: 'END_TURN' }]);
        });
    });
});
