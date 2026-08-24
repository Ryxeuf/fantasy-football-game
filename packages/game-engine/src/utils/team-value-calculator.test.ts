import { describe, it, expect } from 'vitest';
import { getRerollCost, getAllRerollCosts, getPlayerCost, calculateTeamValue } from '../utils/team-value-calculator';

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

    it('should return correct cost for Dark Elf (canonical slug)', () => {
      expect(getRerollCost('dark_elf')).toBe(50000);
    });

    it('should return correct cost for Wood Elf (canonical slug)', () => {
      expect(getRerollCost('wood_elf')).toBe(50000);
    });

    it('should return correct cost for Chaos Chosen (canonical slug)', () => {
      expect(getRerollCost('chaos_chosen')).toBe(60000);
    });

    it('should return correct cost for Black Orc (canonical slug)', () => {
      expect(getRerollCost('black_orc')).toBe(60000);
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
    it('should return all reroll costs with canonical slugs', () => {
      const costs = getAllRerollCosts();
      expect(costs.skaven).toBe(50000);
      expect(costs.lizardmen).toBe(70000);
      expect(costs.human).toBe(50000);
      expect(costs.dark_elf).toBe(50000);
      expect(costs.wood_elf).toBe(50000);
      expect(costs.chaos_chosen).toBe(60000);
      expect(costs.black_orc).toBe(60000);
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

  describe('calculateTeamValue — staff config', () => {
    const base = {
      players: [{ cost: 100000, available: true }],
      rerolls: 2,
      cheerleaders: 3,
      assistants: 1,
      apothecary: true,
      roster: 'human',
    } as const;

    it('sans config : reproduit les défauts bb11', () => {
      // joueurs 100k + relances 2×50k + cheerleaders 3×10k + assistant 1×10k
      // + apothicaire 50k = 100k+100k+30k+10k+50k = 290k
      expect(calculateTeamValue({ ...base })).toBe(290000);
    });

    it('avec staffConfig explicite : utilise les coûts fournis', () => {
      const v = calculateTeamValue({
        ...base,
        staffConfig: {
          rerollCost: 100000,
          cheerleaderCost: 20000,
          assistantCost: 20000,
          apothecaryCost: 80000,
        },
      });
      // 100k + 2×100k + 3×20k + 1×20k + 80k = 100k+200k+60k+20k+80k = 460k
      expect(v).toBe(460000);
    });

    it('format sevens (sans config) : relance ×2 et staff à 20k', () => {
      const v = calculateTeamValue({ ...base, format: 'sevens' });
      // 100k + 2×100k + 3×20k + 1×20k + 80k = 460k
      expect(v).toBe(460000);
    });

    it('les fans dévoués ne comptent ni dans la VE ni dans la VEA', () => {
      // Le calcul ne prend plus les fans en entrée : une équipe sans staff
      // ni relances vaut exactement le coût de ses joueurs, quel que soit
      // son nombre de fans dévoués.
      const v = calculateTeamValue({
        ...base,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
      });
      expect(v).toBe(100000);
    });
  });
});
