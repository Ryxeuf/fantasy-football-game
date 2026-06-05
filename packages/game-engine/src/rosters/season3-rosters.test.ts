import { describe, it, expect } from 'vitest';
import { SEASON_THREE_ROSTERS } from './season3-rosters';
import { TEAM_ROSTERS_BY_RULESET } from './positions';

describe('Season 3 Rosters', () => {
  describe('Roster descriptions (I.2)', () => {
    const rosterKeys = Object.keys(SEASON_THREE_ROSTERS);

    it('should have descriptionFr for all 30 rosters', () => {
      for (const key of rosterKeys) {
        const roster = SEASON_THREE_ROSTERS[key];
        expect(roster.descriptionFr, `${key} missing descriptionFr`).toBeDefined();
        expect(roster.descriptionFr!.length, `${key} descriptionFr is empty`).toBeGreaterThan(0);
      }
    });

    it('should have descriptionEn for all 30 rosters', () => {
      for (const key of rosterKeys) {
        const roster = SEASON_THREE_ROSTERS[key];
        expect(roster.descriptionEn, `${key} missing descriptionEn`).toBeDefined();
        expect(roster.descriptionEn!.length, `${key} descriptionEn is empty`).toBeGreaterThan(0);
      }
    });

    it('should have matching descriptions with Season 2 rosters', () => {
      const s2Rosters = TEAM_ROSTERS_BY_RULESET.season_2;
      for (const key of rosterKeys) {
        if (s2Rosters[key]) {
          expect(
            SEASON_THREE_ROSTERS[key].descriptionFr,
            `${key} descriptionFr should match S2`
          ).toBe(s2Rosters[key].descriptionFr);
          expect(
            SEASON_THREE_ROSTERS[key].descriptionEn,
            `${key} descriptionEn should match S2`
          ).toBe(s2Rosters[key].descriptionEn);
        }
      }
    });
  });

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

  // Source de verite : data/saison3/team/Hauts_elfes.md
  // Roster thematique : Trois-quart, Guerrier Phoenix (Lanceur),
  // Prince Dragon (Receveur), Lion Blanc (Blitzer).
  describe('Regle: High Elf roster (S3, themed)', () => {
    const highElf = SEASON_THREE_ROSTERS.high_elf;

    it('a 4 positions dans l ordre de la markdown', () => {
      expect(highElf.positions.map((p) => p.slug)).toEqual([
        'high_elf_trois_quart_haut_elfe',
        'high_elf_lanceur_haut_elfe',
        'high_elf_receveur_haut_elfe',
        'high_elf_blitzer_haut_elfe',
      ]);
    });

    it('Trois-quart Haut Elfe (65k, 0-16, 6/3/2+/3+/9+, aucune compétence)', () => {
      const p = highElf.positions.find(
        (x) => x.slug === 'high_elf_trois_quart_haut_elfe',
      )!;
      expect(p.displayName).toBe('Trois-quart Haut Elfe');
      expect([p.cost, p.min, p.max]).toEqual([65, 0, 16]);
      expect([p.ma, p.st, p.ag, p.pa, p.av]).toEqual([6, 3, 2, 3, 9]);
      expect(p.skills).toBe('');
    });

    it('Guerrier Phoenix = Lanceur (90k, 0-2, 6/3/2+/2+/9+, Passe/Passe Assurée/Perce-nuages)', () => {
      const p = highElf.positions.find(
        (x) => x.slug === 'high_elf_lanceur_haut_elfe',
      )!;
      expect(p.displayName).toBe('Guerrier Phoenix');
      expect([p.cost, p.min, p.max]).toEqual([90, 0, 2]);
      expect([p.ma, p.st, p.ag, p.pa, p.av]).toEqual([6, 3, 2, 2, 9]);
      expect(p.skills).toBe('pass,safe-pass,cloud-burster');
    });

    it('Prince Dragon = Receveur (110k, 0-2, 8/3/2+/4+/9+, Appuis sûrs/Blocage/Ma balle)', () => {
      const p = highElf.positions.find(
        (x) => x.slug === 'high_elf_receveur_haut_elfe',
      )!;
      expect(p.displayName).toBe('Prince Dragon');
      expect([p.cost, p.min, p.max]).toEqual([110, 0, 2]);
      expect([p.ma, p.st, p.ag, p.pa, p.av]).toEqual([8, 3, 2, 4, 9]);
      expect(p.skills).toBe('surefoot,block,my-ball');
    });

    it('Lion Blanc = Blitzer (110k, 0-2, 7/3/2+/3+/9+, Griffes/Lutte)', () => {
      const p = highElf.positions.find(
        (x) => x.slug === 'high_elf_blitzer_haut_elfe',
      )!;
      expect(p.displayName).toBe('Lion Blanc');
      expect([p.cost, p.min, p.max]).toEqual([110, 0, 2]);
      expect([p.ma, p.st, p.ag, p.pa, p.av]).toEqual([7, 3, 2, 3, 9]);
      expect(p.skills).toBe('claws,wrestle');
    });

    it('ne contient plus les anciens noms génériques', () => {
      const names = highElf.positions.map((p) => p.displayName);
      expect(names).not.toContain('Receveur Haut Elfe');
      expect(names).not.toContain('Lanceur Haut Elfe');
      expect(names).not.toContain('Blitzer Haut Elfe');
    });
  });
});
