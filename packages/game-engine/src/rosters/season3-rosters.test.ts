import { describe, it, expect } from 'vitest';
import { SEASON_THREE_ROSTERS } from './season3-rosters';

describe('Season 3 Rosters', () => {
  describe('Roster completeness', () => {
    it('should contain 30 rosters (same as Season 2)', () => {
      const rosterCount = Object.keys(SEASON_THREE_ROSTERS).length;
      expect(rosterCount).toBe(30);
    });

    it('should include Slann roster', () => {
      expect(SEASON_THREE_ROSTERS.slann).toBeDefined();
    });
  });

  describe('Regle: Slann roster (I.1)', () => {
    it('should have correct team metadata', () => {
      const slann = SEASON_THREE_ROSTERS.slann;
      expect(slann.name).toBe('Slann');
      expect(slann.budget).toBe(1000);
      expect(slann.tier).toBe('II');
    });

    it('should have 4 position types', () => {
      const slann = SEASON_THREE_ROSTERS.slann;
      expect(slann.positions).toHaveLength(4);
    });

    it('should have correct Lineman position', () => {
      const slann = SEASON_THREE_ROSTERS.slann;
      const lineman = slann.positions.find(p => p.slug === 'slann_trois_quart');
      expect(lineman).toBeDefined();
      expect(lineman!.displayName).toBe('Trois-quart Slann');
      expect(lineman!.cost).toBe(60);
      expect(lineman!.min).toBe(0);
      expect(lineman!.max).toBe(16);
      expect(lineman!.ma).toBe(6);
      expect(lineman!.st).toBe(3);
      expect(lineman!.ag).toBe(3);
      expect(lineman!.pa).toBe(4);
      expect(lineman!.av).toBe(9);
      expect(lineman!.skills).toContain('pogo-stick');
      expect(lineman!.skills).toContain('very-long-legs');
    });

    it('should have correct Catcher position', () => {
      const slann = SEASON_THREE_ROSTERS.slann;
      const catcher = slann.positions.find(p => p.slug === 'slann_receveur');
      expect(catcher).toBeDefined();
      expect(catcher!.displayName).toBe('Receveur Slann');
      expect(catcher!.cost).toBe(80);
      expect(catcher!.min).toBe(0);
      expect(catcher!.max).toBe(4);
      expect(catcher!.ma).toBe(7);
      expect(catcher!.st).toBe(2);
      expect(catcher!.ag).toBe(2);
      expect(catcher!.pa).toBe(4);
      expect(catcher!.av).toBe(8);
      expect(catcher!.skills).toContain('diving-catch');
      expect(catcher!.skills).toContain('pogo-stick');
      expect(catcher!.skills).toContain('very-long-legs');
    });

    it('should have correct Blitzer position', () => {
      const slann = SEASON_THREE_ROSTERS.slann;
      const blitzer = slann.positions.find(p => p.slug === 'slann_blitzer');
      expect(blitzer).toBeDefined();
      expect(blitzer!.displayName).toBe('Blitzer Slann');
      expect(blitzer!.cost).toBe(110);
      expect(blitzer!.min).toBe(0);
      expect(blitzer!.max).toBe(4);
      expect(blitzer!.ma).toBe(7);
      expect(blitzer!.st).toBe(3);
      expect(blitzer!.ag).toBe(3);
      expect(blitzer!.pa).toBe(4);
      expect(blitzer!.av).toBe(9);
      expect(blitzer!.skills).toContain('diving-tackle');
      expect(blitzer!.skills).toContain('jump-up');
      expect(blitzer!.skills).toContain('pogo-stick');
      expect(blitzer!.skills).toContain('very-long-legs');
    });

    it('should have correct Kroxigor position', () => {
      const slann = SEASON_THREE_ROSTERS.slann;
      const kroxigor = slann.positions.find(p => p.slug === 'slann_kroxigor');
      expect(kroxigor).toBeDefined();
      expect(kroxigor!.displayName).toBe('Kroxigor');
      expect(kroxigor!.cost).toBe(140);
      expect(kroxigor!.min).toBe(0);
      expect(kroxigor!.max).toBe(1);
      expect(kroxigor!.ma).toBe(6);
      expect(kroxigor!.st).toBe(5);
      expect(kroxigor!.ag).toBe(5);
      expect(kroxigor!.pa).toBe(6);
      expect(kroxigor!.av).toBe(10);
      expect(kroxigor!.skills).toContain('bone-head');
      expect(kroxigor!.skills).toContain('loner-4');
      expect(kroxigor!.skills).toContain('mighty-blow-1');
      expect(kroxigor!.skills).toContain('prehensile-tail');
      expect(kroxigor!.skills).toContain('thick-skull');
    });

    it('should have valid position constraints (all positions)', () => {
      const slann = SEASON_THREE_ROSTERS.slann;
      for (const pos of slann.positions) {
        expect(pos.cost).toBeGreaterThan(0);
        expect(pos.min).toBeGreaterThanOrEqual(0);
        expect(pos.max).toBeGreaterThan(0);
        expect(pos.ma).toBeGreaterThan(0);
        expect(pos.st).toBeGreaterThan(0);
        expect(pos.ag).toBeGreaterThan(0);
        expect(pos.av).toBeGreaterThan(0);
        expect(pos.slug).toMatch(/^slann_/);
      }
    });
  });
});
