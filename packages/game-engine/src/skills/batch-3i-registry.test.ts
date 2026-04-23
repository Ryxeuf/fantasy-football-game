import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3i — Registre de decouverte UI pour skills niche deja
 * implementes mecaniquement mais absents du `skill-registry`.
 *
 * Les mecaniques correspondantes existent deja :
 *  - `leap`           -> mechanics/leap.ts
 *  - `stab`           -> mechanics/stab.ts
 *  - `projectile-vomit` -> mechanics/projectile-vomit.ts
 *
 * Sans entree dans le registre, `getSkillEffect(slug)` retournait `undefined`,
 * ce qui privait l'UI du catalogue (description) et empechait la decouverte
 * automatique par les composants qui iterent sur `getAllRegisteredSkills()`.
 */

const BATCH_SKILLS = ['leap', 'stab', 'projectile-vomit'] as const;

describe('O.1 batch 3i — skill-registry discovery entries', () => {
  describe('getSkillEffect', () => {
    for (const slug of BATCH_SKILLS) {
      it(`trouve le skill "${slug}"`, () => {
        const effect = getSkillEffect(slug);
        expect(effect, `registry entry missing for ${slug}`).toBeDefined();
        expect(effect!.slug).toBe(slug);
      });

      it(`le skill "${slug}" declare un trigger on-activation`, () => {
        const effect = getSkillEffect(slug);
        expect(effect!.triggers).toContain('on-activation');
      });

      it(`le skill "${slug}" a une description non vide`, () => {
        const effect = getSkillEffect(slug);
        expect(effect!.description.length).toBeGreaterThan(0);
      });

      it(`le skill "${slug}" declare canApply`, () => {
        const effect = getSkillEffect(slug);
        expect(typeof effect!.canApply).toBe('function');
      });
    }
  });

  describe('getAllRegisteredSkills', () => {
    it('inclut les 3 skills du batch 3i', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const slug of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger("on-activation")', () => {
    it('inclut les 3 skills du batch 3i', () => {
      const slugs = getSkillsForTrigger('on-activation').map((e) => e.slug);
      for (const slug of BATCH_SKILLS) {
        expect(slugs, `missing ${slug} in on-activation trigger`).toContain(slug);
      }
    });
  });

  describe('canApply : strict sur le slug', () => {
    const baseCtx = {
      player: {
        id: 'p1',
        team: 'A' as const,
        pos: { x: 0, y: 0 },
        name: 'T',
        number: 1,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: [] as string[],
        pm: 6,
        state: 'active' as const,
      },
      state: {} as any,
    };

    for (const slug of BATCH_SKILLS) {
      it(`"${slug}" : canApply = false sans le skill`, () => {
        const effect = getSkillEffect(slug)!;
        expect(effect.canApply(baseCtx as any)).toBe(false);
      });

      it(`"${slug}" : canApply = true avec le skill`, () => {
        const effect = getSkillEffect(slug)!;
        const ctx = {
          ...baseCtx,
          player: { ...baseCtx.player, skills: [slug] },
        };
        expect(effect.canApply(ctx as any)).toBe(true);
      });
    }
  });
});
