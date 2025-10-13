import { describe, it, expect } from 'vitest';
import { getRerollCost, getAllRerollCosts, getPlayerCost } from '../utils/team-value-calculator';
describe('Team Value Calculator', () => {
    describe('getRerollCost', () => {
        it('should return correct cost for Skaven', () => {
            expect(getRerollCost('skaven')).toBe(50000);
        });
        it('should return correct cost for Lizardmen', () => {
            expect(getRerollCost('lizardmen')).toBe(70000);
        });
        it('should return correct cost for Human', () => {
            expect(getRerollCost('human')).toBe(50000);
        });
        it('should return correct cost for Dark Elf', () => {
            expect(getRerollCost('darkelf')).toBe(50000);
        });
        it('should return correct cost for Wood Elf', () => {
            expect(getRerollCost('woodelf')).toBe(50000);
        });
        it('should return correct cost for Chaos', () => {
            expect(getRerollCost('chaos')).toBe(60000);
        });
        it('should return correct cost for Goblin', () => {
            expect(getRerollCost('goblin')).toBe(60000);
        });
        it('should return correct cost for Halfling', () => {
            expect(getRerollCost('halfling')).toBe(60000);
        });
        it('should return default cost for unknown team', () => {
            expect(getRerollCost('unknown')).toBe(50000);
        });
    });
    describe('getAllRerollCosts', () => {
        it('should return all reroll costs', () => {
            const costs = getAllRerollCosts();
            expect(costs.skaven).toBe(50000);
            expect(costs.lizardmen).toBe(70000);
            expect(costs.human).toBe(50000);
            expect(costs.darkelf).toBe(50000);
            expect(costs.woodelf).toBe(50000);
            expect(costs.chaos).toBe(60000);
            expect(costs.goblin).toBe(60000);
            expect(costs.halfling).toBe(60000);
        });
    });
    describe('getPlayerCost', () => {
        it('should return correct cost for Skaven Lineman', () => {
            expect(getPlayerCost('Lineman', 'skaven')).toBe(50000);
        });
        it('should return correct cost for Skaven Thrower', () => {
            expect(getPlayerCost('Thrower', 'skaven')).toBe(85000);
        });
        it('should return correct cost for Skaven Blitzer', () => {
            expect(getPlayerCost('Blitzer', 'skaven')).toBe(90000);
        });
        it('should return correct cost for Skaven Gutter Runner', () => {
            expect(getPlayerCost('Gutter Runner', 'skaven')).toBe(85000);
        });
        it('should return correct cost for Skaven Rat Ogre', () => {
            expect(getPlayerCost('Rat Ogre', 'skaven')).toBe(150000);
        });
        it('should return correct cost for Human Lineman', () => {
            expect(getPlayerCost('Lineman', 'human')).toBe(50000);
        });
        it('should return correct cost for Human Thrower', () => {
            expect(getPlayerCost('Thrower', 'human')).toBe(70000);
        });
        it('should return correct cost for Human Blitzer', () => {
            expect(getPlayerCost('Blitzer', 'human')).toBe(85000);
        });
        it('should return correct cost for Human Catcher', () => {
            expect(getPlayerCost('Catcher', 'human')).toBe(65000);
        });
        it('should return correct cost for Human Ogre', () => {
            expect(getPlayerCost('Ogre', 'human')).toBe(140000);
        });
        it('should return default cost for unknown position', () => {
            expect(getPlayerCost('Unknown Position', 'skaven')).toBe(50000);
        });
        it('should return default cost for unknown roster', () => {
            expect(getPlayerCost('Lineman', 'unknown')).toBe(50000);
        });
    });
});
