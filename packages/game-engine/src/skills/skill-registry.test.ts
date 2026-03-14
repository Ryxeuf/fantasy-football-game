import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
  collectModifiers,
} from './skill-registry';
import type { Player, GameState } from '../core/types';
import { setup } from '../core/game-state';

// Helper to create a test player
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'test-p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 9,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

describe('Skill Registry', () => {
  describe('getSkillEffect', () => {
    it('finds block skill', () => {
      const effect = getSkillEffect('block');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('block');
    });

    it('finds dodge skill', () => {
      const effect = getSkillEffect('dodge');
      expect(effect).toBeDefined();
    });

    it('finds all base skills', () => {
      const baseSlugs = ['block', 'dodge', 'tackle', 'sure-hands', 'sure-feet', 'guard', 'mighty-blow'];
      for (const slug of baseSlugs) {
        expect(getSkillEffect(slug)).toBeDefined();
      }
    });

    it('finds advanced skills', () => {
      const advancedSlugs = [
        'dauntless', 'frenzy', 'jump-up', 'stand-firm', 'side-step',
        'dirty-player-1', 'pass', 'catch', 'thick-skull', 'stunty',
        'wrestle', 'fend', 'strip-ball', 'pro', 'break-tackle',
        'horns', 'juggernaut', 'sprint', 'leader',
        'grab', 'diving-tackle', 'diving-catch', 'accurate', 'strong-arm',
        'prehensile-tail', 'two-heads', 'very-long-legs', 'big-hand',
        'extra-arms', 'claws', 'iron-hard-skin', 'pile-driver', 'brawler',
      ];
      for (const slug of advancedSlugs) {
        const effect = getSkillEffect(slug);
        expect(effect, `Missing skill: ${slug}`).toBeDefined();
      }
    });
  });

  describe('getAllRegisteredSkills', () => {
    it('returns at least 30 skills', () => {
      const skills = getAllRegisteredSkills();
      expect(skills.length).toBeGreaterThanOrEqual(30);
    });
  });

  describe('getSkillsForTrigger', () => {
    it('finds block-related skills', () => {
      const blockSkills = getSkillsForTrigger('on-block-result');
      expect(blockSkills.length).toBeGreaterThanOrEqual(3); // block, dodge, wrestle
    });

    it('finds dodge-related skills', () => {
      const dodgeSkills = getSkillsForTrigger('on-dodge');
      expect(dodgeSkills.length).toBeGreaterThanOrEqual(3); // dodge, break-tackle, diving-tackle, etc.
    });
  });

  describe('collectModifiers', () => {
    it('collects dodge modifiers from two-heads', () => {
      const player = makePlayer({ skills: ['two-heads'] });
      const state = setup();
      const mods = collectModifiers(player, 'on-dodge', { state });
      expect(mods.dodgeModifier).toBe(1);
    });

    it('collects catch modifiers from extra-arms', () => {
      const player = makePlayer({ skills: ['extra-arms'] });
      const state = setup();
      const mods = collectModifiers(player, 'on-catch', { state });
      expect(mods.catchModifier).toBe(1);
    });

    it('stacks multiple modifiers', () => {
      const player = makePlayer({ skills: ['extra-arms', 'diving-catch'] });
      const state = setup();
      const mods = collectModifiers(player, 'on-catch', { state });
      expect(mods.catchModifier).toBeGreaterThanOrEqual(2);
    });
  });
});
