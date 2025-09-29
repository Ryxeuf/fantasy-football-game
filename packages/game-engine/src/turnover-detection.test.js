import { describe, it, expect, beforeEach } from 'vitest';
import { setup, getLegalMoves, applyMove, makeRNG, canBlitz, } from './index';
describe('Détection du Turnover', () => {
    let state;
    let rng;
    beforeEach(() => {
        state = setup();
        rng = makeRNG('turnover-test-seed');
    });
    describe('getLegalMoves avec turnover', () => {
        it('ne devrait retourner que END_TURN quand isTurnover est true', () => {
            // Simuler un état de turnover
            const turnoverState = {
                ...state,
                isTurnover: true,
            };
            const moves = getLegalMoves(turnoverState);
            // Seul END_TURN devrait être disponible
            expect(moves).toHaveLength(1);
            expect(moves[0]).toEqual({ type: 'END_TURN' });
        });
        it('devrait retourner des mouvements normaux quand isTurnover est false', () => {
            const moves = getLegalMoves(state);
            // Devrait avoir plus que juste END_TURN
            expect(moves.length).toBeGreaterThan(1);
            expect(moves).toContainEqual({ type: 'END_TURN' });
            // Devrait avoir des mouvements MOVE
            const moveMoves = moves.filter(m => m.type === 'MOVE');
            expect(moveMoves.length).toBeGreaterThan(0);
        });
    });
    describe('applyMove avec turnover', () => {
        it('ne devrait pas permettre de mouvement quand isTurnover est true', () => {
            // Simuler un état de turnover
            const turnoverState = {
                ...state,
                isTurnover: true,
            };
            // Essayer de faire un mouvement
            const move = {
                type: 'MOVE',
                playerId: 'A1',
                to: { x: 1, y: 1 }
            };
            const result = applyMove(turnoverState, move, rng);
            // L'état ne devrait pas changer
            expect(result).toBe(turnoverState);
        });
        it('devrait permettre END_TURN même en cas de turnover', () => {
            // Simuler un état de turnover
            const turnoverState = {
                ...state,
                isTurnover: true,
            };
            const move = { type: 'END_TURN' };
            const result = applyMove(turnoverState, move, rng);
            // L'état devrait changer (fin de tour)
            expect(result).not.toBe(turnoverState);
            expect(result.isTurnover).toBe(false);
        });
    });
    describe('Scénario complet: échec de blitz', () => {
        it('devrait déclencher un turnover après un échec de blitz', () => {
            // Positionner les joueurs pour un blitz avec des adversaires adjacents au joueur A1
            const testState = {
                ...state,
                players: state.players.map(p => {
                    if (p.id === 'A1')
                        return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, ag: 1 }; // AG très faible
                    if (p.id === 'B1')
                        return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 }; // Adjacent à la destination
                    if (p.id === 'B2')
                        return { ...p, pos: { x: 11, y: 6 }, stunned: false, pm: 8 }; // Adjacent à A1
                    if (p.id === 'B3')
                        return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 8 }; // Adjacent à A1
                    if (p.id === 'B4')
                        return { ...p, pos: { x: 10, y: 6 }, stunned: false, pm: 8 }; // Adjacent à A1
                    if (p.id === 'B5')
                        return { ...p, pos: { x: 10, y: 8 }, stunned: false, pm: 8 }; // Adjacent à A1
                    return p;
                }),
            };
            // Faire un blitz qui va échouer (beaucoup d'adversaires = malus élevé)
            const blitzMove = {
                type: 'BLITZ',
                playerId: 'A1',
                to: { x: 11, y: 7 },
                targetId: 'B1'
            };
            // Utiliser un RNG qui va faire échouer le jet d'esquive (retourne toujours 1)
            const failingRng = () => 0.1; // Toujours 1 sur un D6
            const result = applyMove(testState, blitzMove, failingRng);
            // Debug: afficher l'état du résultat
            console.log('Résultat du blitz:', {
                isTurnover: result.isTurnover,
                playerA1: result.players.find(p => p.id === 'A1'),
                canBlitz: canBlitz(testState, 'A1', { x: 11, y: 7 }, 'B1'),
                teamBlitzCount: testState.teamBlitzCount,
                gameLog: result.gameLog.slice(-5) // Derniers 5 logs
            });
            // Vérifier que le turnover est déclenché
            expect(result.isTurnover).toBe(true);
            // Vérifier que seul END_TURN est disponible
            const moves = getLegalMoves(result);
            expect(moves).toHaveLength(1);
            expect(moves[0]).toEqual({ type: 'END_TURN' });
        });
    });
});
