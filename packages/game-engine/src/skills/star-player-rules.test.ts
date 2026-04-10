import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSkillEffect,
  collectModifiers,
} from './skill-registry';
import type { Player, GameState } from '../core/types';
import { setup } from '../core/game-state';

// Import to trigger registration of star player rules
import './star-player-rules';

// Helper to create a test player
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'star-p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Star Player',
    number: 99,
    position: 'Star Player',
    ma: 6, st: 3, ag: 3, pa: 4, av: 9,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function makeOpponent(overrides: Partial<Player> = {}): Player {
  return makePlayer({
    id: 'opp-p1',
    team: 'B',
    pos: { x: 6, y: 5 },
    name: 'Opponent',
    number: 1,
    ...overrides,
  });
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...setup(),
    usedStarPlayerRules: {},
    ...overrides,
  };
}

describe('Star Player Special Rules', () => {
  describe('Règle: blind-rage (Akhorne)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('blind-rage');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('blind-rage');
    });

    it('should trigger on-block-attacker', () => {
      const effect = getSkillEffect('blind-rage')!;
      expect(effect.triggers).toContain('on-block-attacker');
    });

    it('should allow reroll when player has blind-rage and dauntless', () => {
      const player = makePlayer({
        skills: ['blind-rage', 'dauntless'],
        st: 2,
      });
      const opponent = makeOpponent({ st: 4 });
      const state = makeState();
      const effect = getSkillEffect('blind-rage')!;

      expect(effect.canApply({ player, opponent, state })).toBe(true);
      expect(effect.canReroll!({ player, opponent, state })).toBe(true);
    });

    it('should not apply if player lacks dauntless', () => {
      const player = makePlayer({ skills: ['blind-rage'] });
      const state = makeState();
      const effect = getSkillEffect('blind-rage')!;

      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('Règle: slayer (Grim Ironjaw)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('slayer');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('slayer');
    });

    it('should allow reroll on failed Dauntless', () => {
      const player = makePlayer({
        skills: ['slayer', 'dauntless'],
        st: 2,
      });
      const opponent = makeOpponent({ st: 4 });
      const state = makeState();
      const effect = getSkillEffect('slayer')!;

      expect(effect.canApply({ player, opponent, state })).toBe(true);
      expect(effect.canReroll!({ player, opponent, state })).toBe(true);
    });
  });

  describe('Règle: coup-sauvage (Anqi Panqi)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('coup-sauvage');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('coup-sauvage');
    });

    it('should trigger on-block-attacker', () => {
      const effect = getSkillEffect('coup-sauvage')!;
      expect(effect.triggers).toContain('on-block-attacker');
    });

    it('should allow reroll when not yet used this game', () => {
      const player = makePlayer({ skills: ['coup-sauvage'] });
      const state = makeState({ usedStarPlayerRules: {} });
      const effect = getSkillEffect('coup-sauvage')!;

      expect(effect.canApply({ player, state })).toBe(true);
      expect(effect.canReroll!({ player, state })).toBe(true);
    });

    it('should NOT allow reroll when already used this game', () => {
      const player = makePlayer({ id: 'star-p1', skills: ['coup-sauvage'] });
      const state = makeState({
        usedStarPlayerRules: { 'star-p1:coup-sauvage': true },
      });
      const effect = getSkillEffect('coup-sauvage')!;

      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('Règle: la-baliste (Morg \'n\' Thorg)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('la-baliste');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('la-baliste');
    });

    it('should trigger on-pass', () => {
      const effect = getSkillEffect('la-baliste')!;
      expect(effect.triggers).toContain('on-pass');
    });

    it('should allow reroll when not yet used', () => {
      const player = makePlayer({ skills: ['la-baliste'] });
      const state = makeState({ usedStarPlayerRules: {} });
      const effect = getSkillEffect('la-baliste')!;

      expect(effect.canApply({ player, state })).toBe(true);
      expect(effect.canReroll!({ player, state })).toBe(true);
    });

    it('should NOT allow reroll when already used', () => {
      const player = makePlayer({ id: 'star-p1', skills: ['la-baliste'] });
      const state = makeState({
        usedStarPlayerRules: { 'star-p1:la-baliste': true },
      });
      const effect = getSkillEffect('la-baliste')!;

      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('Règle: consummate-professional (Griff Oberwald)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('consummate-professional');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('consummate-professional');
    });

    it('should trigger on multiple roll types', () => {
      const effect = getSkillEffect('consummate-professional')!;
      expect(effect.triggers).toContain('on-dodge');
      expect(effect.triggers).toContain('on-block-attacker');
      expect(effect.triggers).toContain('on-pass');
      expect(effect.triggers).toContain('on-catch');
      expect(effect.triggers).toContain('on-pickup');
      expect(effect.triggers).toContain('on-gfi');
    });

    it('should allow reroll when not yet used', () => {
      const player = makePlayer({ skills: ['consummate-professional'] });
      const state = makeState({ usedStarPlayerRules: {} });
      const effect = getSkillEffect('consummate-professional')!;

      expect(effect.canApply({ player, state })).toBe(true);
      expect(effect.canReroll!({ player, state })).toBe(true);
    });

    it('should NOT allow reroll when already used', () => {
      const player = makePlayer({ id: 'star-p1', skills: ['consummate-professional'] });
      const state = makeState({
        usedStarPlayerRules: { 'star-p1:consummate-professional': true },
      });
      const effect = getSkillEffect('consummate-professional')!;

      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('Règle: crushing-blow (Varag Ghoul-Chewer)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('crushing-blow');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('crushing-blow');
    });

    it('should trigger on-armor', () => {
      const effect = getSkillEffect('crushing-blow')!;
      expect(effect.triggers).toContain('on-armor');
    });

    it('should give +1 armor modifier when not yet used', () => {
      const player = makePlayer({ skills: ['crushing-blow'] });
      const state = makeState({ usedStarPlayerRules: {} });
      const effect = getSkillEffect('crushing-blow')!;

      expect(effect.canApply({ player, state })).toBe(true);
      const mods = effect.getModifiers!({ player, state });
      expect(mods.armorModifier).toBe(1);
    });

    it('should NOT apply when already used', () => {
      const player = makePlayer({ id: 'star-p1', skills: ['crushing-blow'] });
      const state = makeState({
        usedStarPlayerRules: { 'star-p1:crushing-blow': true },
      });
      const effect = getSkillEffect('crushing-blow')!;

      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('Règle: lord-of-chaos (Lord Borak)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('lord-of-chaos');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('lord-of-chaos');
    });

    it('should trigger as passive', () => {
      const effect = getSkillEffect('lord-of-chaos')!;
      expect(effect.triggers).toContain('passive');
    });

    it('should apply when player has the skill', () => {
      const player = makePlayer({ skills: ['lord-of-chaos'] });
      const state = makeState();
      const effect = getSkillEffect('lord-of-chaos')!;

      expect(effect.canApply({ player, state })).toBe(true);
    });

    it('should grant +1 team reroll via specialEffect', () => {
      const player = makePlayer({ skills: ['lord-of-chaos'], team: 'A' });
      const state = makeState({ half: 1 });
      const effect = getSkillEffect('lord-of-chaos')!;

      const result = effect.specialEffect!({ player, state });
      expect(result).toBeDefined();
      expect(result!.teamRerolls).toBeDefined();
    });

    it('should NOT grant reroll in second half', () => {
      const player = makePlayer({ skills: ['lord-of-chaos'], team: 'A' });
      const state = makeState({ half: 2 });
      const effect = getSkillEffect('lord-of-chaos')!;

      const result = effect.specialEffect!({ player, state });
      expect(result).toBeNull();
    });
  });

  describe('Règle: pirouette (Roxanna Darknail)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('pirouette');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('pirouette');
    });

    it('should trigger on-dodge', () => {
      const effect = getSkillEffect('pirouette')!;
      expect(effect.triggers).toContain('on-dodge');
    });

    it('should give +1 dodge modifier', () => {
      const player = makePlayer({ skills: ['pirouette'] });
      const state = makeState({ usedStarPlayerRules: {} });
      const effect = getSkillEffect('pirouette')!;

      expect(effect.canApply({ player, state })).toBe(true);
      const mods = effect.getModifiers!({ player, state });
      expect(mods.dodgeModifier).toBe(1);
    });

    it('should NOT apply when already used this turn', () => {
      const player = makePlayer({ id: 'star-p1', skills: ['pirouette'] });
      const state = makeState({
        usedStarPlayerRules: { 'star-p1:pirouette': true },
      });
      const effect = getSkillEffect('pirouette')!;

      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('Règle: casse-os (Mighty Zug)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('casse-os');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('casse-os');
    });

    it('should trigger on-block-attacker', () => {
      const effect = getSkillEffect('casse-os')!;
      expect(effect.triggers).toContain('on-block-attacker');
    });

    it('should give +1 strength modifier when not yet used', () => {
      const player = makePlayer({ skills: ['casse-os'] });
      const state = makeState({ usedStarPlayerRules: {} });
      const effect = getSkillEffect('casse-os')!;

      expect(effect.canApply({ player, state })).toBe(true);
      const mods = effect.getModifiers!({ player, state });
      expect(mods.strengthModifier).toBe(1);
    });

    it('should NOT apply when already used', () => {
      const player = makePlayer({ id: 'star-p1', skills: ['casse-os'] });
      const state = makeState({
        usedStarPlayerRules: { 'star-p1:casse-os': true },
      });
      const effect = getSkillEffect('casse-os')!;

      expect(effect.canApply({ player, state })).toBe(false);
    });
  });

  describe('Règle: reliable (Deeproot Strongbranch)', () => {
    it('should be registered in skill registry', () => {
      const effect = getSkillEffect('reliable');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('reliable');
    });

    it('should trigger on-pass', () => {
      const effect = getSkillEffect('reliable')!;
      expect(effect.triggers).toContain('on-pass');
    });

    it('should apply when player has the skill', () => {
      const player = makePlayer({ skills: ['reliable'] });
      const state = makeState();
      const effect = getSkillEffect('reliable')!;

      expect(effect.canApply({ player, state })).toBe(true);
    });

    it('should provide a specialEffect (prevent turnover)', () => {
      const effect = getSkillEffect('reliable')!;
      expect(effect.specialEffect).toBeDefined();
    });
  });

  describe('Integration: collectModifiers with star player rules', () => {
    it('should collect crushing-blow armor modifier', () => {
      const player = makePlayer({ skills: ['crushing-blow'] });
      const state = makeState({ usedStarPlayerRules: {} });

      const mods = collectModifiers(player, 'on-armor', { state });
      expect(mods.armorModifier).toBe(1);
    });

    it('should collect pirouette dodge modifier', () => {
      const player = makePlayer({ skills: ['pirouette'] });
      const state = makeState({ usedStarPlayerRules: {} });

      const mods = collectModifiers(player, 'on-dodge', { state });
      expect(mods.dodgeModifier).toBe(1);
    });

    it('should collect casse-os strength modifier on block', () => {
      const player = makePlayer({ skills: ['casse-os'] });
      const state = makeState({ usedStarPlayerRules: {} });

      const mods = collectModifiers(player, 'on-block-attacker', { state });
      expect(mods.strengthModifier).toBe(1);
    });
  });

  describe('markStarPlayerRuleUsed helper', () => {
    it('should mark a rule as used immutably', async () => {
      const { markStarPlayerRuleUsed } = await import('./star-player-rules');
      const state = makeState({ usedStarPlayerRules: {} });

      const newState = markStarPlayerRuleUsed(state, 'player-1', 'coup-sauvage');

      // Original state unchanged
      expect(state.usedStarPlayerRules).toEqual({});
      // New state has the rule marked
      expect(newState.usedStarPlayerRules['player-1:coup-sauvage']).toBe(true);
    });

    it('should preserve existing used rules', async () => {
      const { markStarPlayerRuleUsed } = await import('./star-player-rules');
      const state = makeState({
        usedStarPlayerRules: { 'player-1:coup-sauvage': true },
      });

      const newState = markStarPlayerRuleUsed(state, 'player-2', 'la-baliste');

      expect(newState.usedStarPlayerRules['player-1:coup-sauvage']).toBe(true);
      expect(newState.usedStarPlayerRules['player-2:la-baliste']).toBe(true);
    });
  });

  describe('isStarPlayerRuleUsed helper', () => {
    it('should return false when rule not used', async () => {
      const { isStarPlayerRuleUsed } = await import('./star-player-rules');
      const state = makeState({ usedStarPlayerRules: {} });

      expect(isStarPlayerRuleUsed(state, 'player-1', 'coup-sauvage')).toBe(false);
    });

    it('should return true when rule is used', async () => {
      const { isStarPlayerRuleUsed } = await import('./star-player-rules');
      const state = makeState({
        usedStarPlayerRules: { 'player-1:coup-sauvage': true },
      });

      expect(isStarPlayerRuleUsed(state, 'player-1', 'coup-sauvage')).toBe(true);
    });

    it('should handle missing usedStarPlayerRules gracefully', async () => {
      const { isStarPlayerRuleUsed } = await import('./star-player-rules');
      const state = makeState();
      // Simulate older state without the field
      delete (state as Record<string, unknown>).usedStarPlayerRules;

      expect(isStarPlayerRuleUsed(state, 'player-1', 'coup-sauvage')).toBe(false);
    });
  });

  describe('STAR_PLAYER_RULE_SLUGS', () => {
    it('should contain all 10 star player rule slugs', async () => {
      const { STAR_PLAYER_RULE_SLUGS } = await import('./star-player-rules');
      expect(STAR_PLAYER_RULE_SLUGS.size).toBe(10);
      expect(STAR_PLAYER_RULE_SLUGS.has('blind-rage')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('slayer')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('coup-sauvage')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('la-baliste')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('consummate-professional')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('crushing-blow')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('lord-of-chaos')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('pirouette')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('casse-os')).toBe(true);
      expect(STAR_PLAYER_RULE_SLUGS.has('reliable')).toBe(true);
    });

    it('should not contain regular skill slugs', async () => {
      const { STAR_PLAYER_RULE_SLUGS } = await import('./star-player-rules');
      expect(STAR_PLAYER_RULE_SLUGS.has('block')).toBe(false);
      expect(STAR_PLAYER_RULE_SLUGS.has('dodge')).toBe(false);
      expect(STAR_PLAYER_RULE_SLUGS.has('mighty-blow')).toBe(false);
    });
  });

  describe('isStarPlayerRule', () => {
    it('should return true for star player rule slugs', async () => {
      const { isStarPlayerRule } = await import('./star-player-rules');
      expect(isStarPlayerRule('coup-sauvage')).toBe(true);
      expect(isStarPlayerRule('blind-rage')).toBe(true);
      expect(isStarPlayerRule('reliable')).toBe(true);
    });

    it('should return false for regular skill slugs', async () => {
      const { isStarPlayerRule } = await import('./star-player-rules');
      expect(isStarPlayerRule('block')).toBe(false);
      expect(isStarPlayerRule('dodge')).toBe(false);
      expect(isStarPlayerRule('loner-4')).toBe(false);
    });
  });

  describe('getPlayerStarRules', () => {
    it('should return empty array for player without star rules', async () => {
      const { getPlayerStarRules } = await import('./star-player-rules');
      const player = makePlayer({ skills: ['block', 'dodge', 'tackle'] });

      const rules = getPlayerStarRules(player);
      expect(rules).toEqual([]);
    });

    it('should return star rule info for player with star rules', async () => {
      const { getPlayerStarRules } = await import('./star-player-rules');
      const player = makePlayer({
        id: 'akhorne-1',
        skills: ['dodge', 'frenzy', 'blind-rage'],
      });

      const rules = getPlayerStarRules(player);
      expect(rules).toHaveLength(1);
      expect(rules[0].slug).toBe('blind-rage');
      expect(rules[0].nameFr).toBe('Rage Aveugle');
      expect(rules[0].nameEn).toBe('Blind Rage');
      expect(rules[0].description).toBeTruthy();
      expect(rules[0].isUsed).toBe(false);
    });

    it('should show rule as used when tracked in usedStarPlayerRules', async () => {
      const { getPlayerStarRules } = await import('./star-player-rules');
      const player = makePlayer({
        id: 'anqi-1',
        skills: ['block', 'grab', 'coup-sauvage'],
      });
      const usedRules = { 'anqi-1:coup-sauvage': true };

      const rules = getPlayerStarRules(player, usedRules);
      expect(rules).toHaveLength(1);
      expect(rules[0].slug).toBe('coup-sauvage');
      expect(rules[0].isUsed).toBe(true);
    });

    it('should show rule as available when not in usedStarPlayerRules', async () => {
      const { getPlayerStarRules } = await import('./star-player-rules');
      const player = makePlayer({
        id: 'anqi-1',
        skills: ['block', 'grab', 'coup-sauvage'],
      });
      const usedRules = { 'other-player:coup-sauvage': true };

      const rules = getPlayerStarRules(player, usedRules);
      expect(rules).toHaveLength(1);
      expect(rules[0].isUsed).toBe(false);
    });

    it('should handle undefined usedStarPlayerRules', async () => {
      const { getPlayerStarRules } = await import('./star-player-rules');
      const player = makePlayer({
        id: 'zug-1',
        skills: ['block', 'mighty-blow', 'casse-os'],
      });

      const rules = getPlayerStarRules(player, undefined);
      expect(rules).toHaveLength(1);
      expect(rules[0].slug).toBe('casse-os');
      expect(rules[0].isUsed).toBe(false);
    });

    it('should return multiple star rules if player has several', async () => {
      const { getPlayerStarRules } = await import('./star-player-rules');
      // Hypothetical player with multiple star player rules
      const player = makePlayer({
        id: 'multi-1',
        skills: ['blind-rage', 'coup-sauvage'],
      });

      const rules = getPlayerStarRules(player);
      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.slug)).toContain('blind-rage');
      expect(rules.map(r => r.slug)).toContain('coup-sauvage');
    });
  });
});
