import { describe, it, expect } from 'vitest';
import { SKILLS_DEFINITIONS, type SkillDefinition } from './index';
import {
  getSkillEffect,
  getAllRegisteredSkills,
} from './skill-registry';

/**
 * O.3 — Verification differences regles S3.
 *
 * Cette suite audite la coherence entre le catalogue de skills
 * (`SKILLS_DEFINITIONS`) et le `skill-registry` pour les skills
 * Season 3 :
 *
 *  - Chaque skill `season3Only: true` DOIT avoir une entree de
 *    decouverte UI dans le registry (batch 3g-3u a couvert
 *    l'essentiel ; cette suite garde la propriete comme
 *    non-regression).
 *  - Chaque skill `isModified: true` DOIT avoir une entree de
 *    decouverte UI dans le registry — cela garantit qu'on peut
 *    differencier la variante S3 d'un skill BB2020 existant
 *    lorsqu'elle est annotee comme telle dans le catalogue.
 *  - Chaque slug annote comme S3 dans `SKILLS_DEFINITIONS` DOIT
 *    pouvoir etre resolu via `getSkillEffect(slug)`.
 *
 * Cet audit est un filet de non-regression : si un nouveau skill
 * S3-only ou modifie-S3 est ajoute sans entree registry, ces
 * tests echouent avec un message precis.
 */

const season3Only: readonly SkillDefinition[] = SKILLS_DEFINITIONS.filter(
  (s) => s.season3Only === true,
);

const isModified: readonly SkillDefinition[] = SKILLS_DEFINITIONS.filter(
  (s) => s.isModified === true,
);

describe('O.3 — S2 vs S3 rules audit', () => {
  describe('couverture `season3Only` dans le registre', () => {
    it('le catalogue contient au moins un skill `season3Only`', () => {
      expect(season3Only.length).toBeGreaterThan(0);
    });

    for (const def of season3Only) {
      it(`"${def.slug}" (season3Only) est present dans le registry`, () => {
        const effect = getSkillEffect(def.slug);
        expect(
          effect,
          `season3Only skill ${def.slug} missing from registry`,
        ).toBeDefined();
      });
    }
  });

  describe('couverture `isModified` dans le registre', () => {
    it('le catalogue contient au moins un skill `isModified`', () => {
      expect(isModified.length).toBeGreaterThan(0);
    });

    for (const def of isModified) {
      it(`"${def.slug}" (isModified) est present dans le registry`, () => {
        const effect = getSkillEffect(def.slug);
        expect(
          effect,
          `isModified skill ${def.slug} missing from registry`,
        ).toBeDefined();
      });
    }
  });

  describe('coherence globale du catalogue', () => {
    it('chaque entree registry a un slug unique', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('chaque skill `season3Only` est aussi `Category` ou `Trait` significatif', () => {
      for (const def of season3Only) {
        expect(
          def.category.length,
          `${def.slug} has empty category`,
        ).toBeGreaterThan(0);
      }
    });

    it('aucun skill `season3Only` n\'est dans `running-pass` non suffixe (evite collision avec S2)', () => {
      // La variante S3 du skill "Running Pass" doit etre `running-pass-2025`
      // (le slug S2 "running-pass" existe aussi et ne doit PAS etre
      // flag S3). On verifie que les flags sont bien poses sur les bons
      // slugs.
      const s2 = SKILLS_DEFINITIONS.find((s) => s.slug === 'running-pass');
      const s3 = SKILLS_DEFINITIONS.find((s) => s.slug === 'running-pass-2025');
      expect(s2, 'running-pass (S2) missing from catalog').toBeDefined();
      expect(s3, 'running-pass-2025 (S3) missing from catalog').toBeDefined();
      expect(s2!.season3Only).not.toBe(true);
      expect(s3!.season3Only).toBe(true);
      expect(s3!.isModified).toBe(true);
    });
  });

  describe('running-pass-2025 : entree dedicee S3', () => {
    it('le skill est declare dans le registry', () => {
      const effect = getSkillEffect('running-pass-2025');
      expect(effect).toBeDefined();
      expect(effect!.slug).toBe('running-pass-2025');
    });

    it('le skill expose le trigger `on-pass`', () => {
      const effect = getSkillEffect('running-pass-2025');
      expect(effect!.triggers).toContain('on-pass');
    });

    it('le skill a une description non vide', () => {
      const effect = getSkillEffect('running-pass-2025');
      expect(effect!.description.length).toBeGreaterThan(0);
    });

    it('canApply est strict sur le slug (false sans le skill)', () => {
      const effect = getSkillEffect('running-pass-2025')!;
      const ctx = {
        player: {
          id: 'p1',
          team: 'A' as const,
          pos: { x: 0, y: 0 },
          name: 'T',
          number: 1,
          position: 'Thrower',
          ma: 6,
          st: 3,
          ag: 3,
          pa: 3,
          av: 9,
          skills: [] as string[],
          pm: 6,
          state: 'active' as const,
        },
        state: {} as any,
      };
      expect(effect.canApply(ctx as any)).toBe(false);
    });

    it('canApply est true avec le slug canonique', () => {
      const effect = getSkillEffect('running-pass-2025')!;
      const ctx = {
        player: {
          id: 'p1',
          team: 'A' as const,
          pos: { x: 0, y: 0 },
          name: 'T',
          number: 1,
          position: 'Thrower',
          ma: 6,
          st: 3,
          ag: 3,
          pa: 3,
          av: 9,
          skills: ['running-pass-2025'] as string[],
          pm: 6,
          state: 'active' as const,
        },
        state: {} as any,
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('running-pass-2025')!;
      const ctx = {
        player: {
          id: 'p1',
          team: 'A' as const,
          pos: { x: 0, y: 0 },
          name: 'T',
          number: 1,
          position: 'Thrower',
          ma: 6,
          st: 3,
          ag: 3,
          pa: 3,
          av: 9,
          skills: ['running_pass_2025'] as string[],
          pm: 6,
          state: 'active' as const,
        },
        state: {} as any,
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it("n'expose pas getModifiers (evite double-comptage avec running-pass S2)", () => {
      const effect = getSkillEffect('running-pass-2025');
      expect(effect!.getModifiers).toBeUndefined();
    });
  });
});
