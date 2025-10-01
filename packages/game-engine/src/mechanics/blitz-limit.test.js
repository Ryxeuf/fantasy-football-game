import { describe, it, expect, beforeEach } from 'vitest';
import { setup, applyMove, makeRNG, canBlitz, getTeamBlitzCount, canTeamBlitz, incrementTeamBlitzCount, clearTeamBlitzCounts, } from '../index';
describe("Limitation d'une seule action de blitz par tour d'équipe", () => {
    let state;
    let rng;
    beforeEach(() => {
        state = setup();
        rng = makeRNG('test');
    });
    it("devrait permettre un blitz quand l'équipe n'en a pas encore fait", () => {
        // Vérifier que l'équipe A peut faire un blitz
        expect(canTeamBlitz(state, 'A')).toBe(true);
        expect(getTeamBlitzCount(state, 'A')).toBe(0);
        // Vérifier qu'un blitz spécifique est possible (A1 vers position adjacente à B1)
        const canBlitzResult = canBlitz(state, 'A1', { x: 14, y: 7 }, 'B1');
        expect(canBlitzResult).toBe(true);
    });
    it('devrait empêcher un deuxième blitz dans le même tour', () => {
        // Faire un premier blitz
        const firstBlitz = applyMove(state, {
            type: 'BLITZ',
            playerId: 'A1',
            to: { x: 14, y: 7 },
            targetId: 'B1',
        }, rng);
        // Vérifier que le compteur a été incrémenté
        expect(getTeamBlitzCount(firstBlitz, 'A')).toBe(1);
        expect(canTeamBlitz(firstBlitz, 'A')).toBe(false);
        // Vérifier qu'un deuxième blitz n'est plus possible
        const canSecondBlitz = canBlitz(firstBlitz, 'A2', { x: 15, y: 6 }, 'B2');
        expect(canSecondBlitz).toBe(false);
    });
    it('devrait réinitialiser le compteur de blitz au changement de tour', () => {
        // Faire un blitz avec l'équipe A
        const afterBlitz = applyMove(state, {
            type: 'BLITZ',
            playerId: 'A1',
            to: { x: 14, y: 7 },
            targetId: 'B1',
        }, rng);
        // Vérifier que l'équipe A ne peut plus faire de blitz
        expect(canTeamBlitz(afterBlitz, 'A')).toBe(false);
        // Finir le tour de l'équipe A
        const afterEndTurn = applyMove(afterBlitz, { type: 'END_TURN' }, rng);
        // Vérifier que le compteur a été réinitialisé
        expect(getTeamBlitzCount(afterEndTurn, 'A')).toBe(0);
        expect(canTeamBlitz(afterEndTurn, 'A')).toBe(true);
        // Vérifier que l'équipe B peut maintenant faire un blitz
        expect(canTeamBlitz(afterEndTurn, 'B')).toBe(true);
    });
    it("devrait permettre à l'équipe B de faire un blitz après que l'équipe A en ait fait un", () => {
        // Faire un blitz avec l'équipe A
        const afterBlitzA = applyMove(state, {
            type: 'BLITZ',
            playerId: 'A1',
            to: { x: 14, y: 7 },
            targetId: 'B1',
        }, rng);
        // Finir le tour de l'équipe A
        const afterEndTurn = applyMove(afterBlitzA, { type: 'END_TURN' }, rng);
        // Vérifier que l'équipe B peut faire un blitz
        expect(canTeamBlitz(afterEndTurn, 'B')).toBe(true);
        expect(getTeamBlitzCount(afterEndTurn, 'B')).toBe(0);
        // Test simple : incrémenter manuellement le compteur pour l'équipe B
        const testIncrement = incrementTeamBlitzCount(afterEndTurn, 'B');
        expect(getTeamBlitzCount(testIncrement, 'B')).toBe(1);
        expect(canTeamBlitz(testIncrement, 'B')).toBe(false);
    });
    it('devrait gérer correctement les fonctions utilitaires de compteur de blitz', () => {
        // Test de getTeamBlitzCount
        expect(getTeamBlitzCount(state, 'A')).toBe(0);
        expect(getTeamBlitzCount(state, 'B')).toBe(0);
        // Test de canTeamBlitz
        expect(canTeamBlitz(state, 'A')).toBe(true);
        expect(canTeamBlitz(state, 'B')).toBe(true);
        // Test de incrementTeamBlitzCount
        const afterIncrement = incrementTeamBlitzCount(state, 'A');
        expect(getTeamBlitzCount(afterIncrement, 'A')).toBe(1);
        expect(canTeamBlitz(afterIncrement, 'A')).toBe(false);
        // Test de clearTeamBlitzCounts
        const afterClear = clearTeamBlitzCounts(afterIncrement);
        expect(getTeamBlitzCount(afterClear, 'A')).toBe(0);
        expect(canTeamBlitz(afterClear, 'A')).toBe(true);
    });
    it('devrait empêcher les blitz multiples dans la même équipe même avec différents joueurs', () => {
        // Faire un blitz avec le premier joueur de l'équipe A
        const afterFirstBlitz = applyMove(state, {
            type: 'BLITZ',
            playerId: 'A1',
            to: { x: 14, y: 7 },
            targetId: 'B1',
        }, rng);
        // Vérifier que le deuxième joueur de l'équipe A ne peut pas faire de blitz
        const canSecondBlitz = canBlitz(afterFirstBlitz, 'A2', { x: 15, y: 6 }, 'B2');
        expect(canSecondBlitz).toBe(false);
        // Vérifier que le compteur reste à 1
        expect(getTeamBlitzCount(afterFirstBlitz, 'A')).toBe(1);
    });
    it('devrait permettre des blitz normaux (BLOCK) même après un blitz', () => {
        // Faire un blitz avec l'équipe A
        const afterBlitz = applyMove(state, {
            type: 'BLITZ',
            playerId: 'A1',
            to: { x: 14, y: 7 },
            targetId: 'B1',
        }, rng);
        // Vérifier qu'un blocage normal est toujours possible
        const canBlock = afterBlitz.players.some(p => p.team === 'A' &&
            !p.stunned &&
            p.pm > 0 &&
            afterBlitz.players.some(opp => opp.team === 'B' &&
                !opp.stunned &&
                Math.abs(p.pos.x - opp.pos.x) <= 1 &&
                Math.abs(p.pos.y - opp.pos.y) <= 1));
        expect(canBlock).toBe(true);
    });
});
