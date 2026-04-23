import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3j — Registre de decouverte UI pour skills niche deja
 * implementes mecaniquement mais absents du `skill-registry`.
 *
 * Les mecaniques correspondantes existent deja :
 *  - `on-the-ball`     -> mechanics/on-the-ball.ts
 *  - `throw-team-mate` -> mechanics/throw-team-mate.ts
 *  - `dump-off`        -> mechanics/dump-off.ts
 *
 * Sans entree dans le registre, `getSkillEffect(slug)` retournait `undefined`,
 * ce qui privait l'UI du catalogue (description) et empechait la decouverte
 * automatique par les composants qui iterent sur `getAllRegisteredSkills()`.
 *
 * Conformement au pattern des batchs 3g (cloud-burster/titchy), 3h
 * (mighty-blow-1/2, dirty-player-2) et 3i (leap, stab, projectile-vomit),
 * ce batch n'ajoute AUCUNE logique moteur : les effets sont deja resolus
 * par les handlers dedies.
 */

interface BatchSkill {
  readonly slug: string;
  readonly trigger: 'on-pass' | 'on-block-defender';
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'on-the-ball', trigger: 'on-pass' },
  { slug: 'throw-team-mate', trigger: 'on-pass' },
  { slug: 'dump-off', trigger: 'on-block-defender' },
];

describe('O.1 batch 3j — skill-registry discovery entries', () => {
  describe('getSkillEffect', () => {
    for (const { slug, trigger } of BATCH_SKILLS) {
      it(`trouve le skill "${slug}"`, () => {
        const effect = getSkillEffect(slug);
        expect(effect, `registry entry missing for ${slug}`).toBeDefined();
        expect(effect!.slug).toBe(slug);
      });

      it(`le skill "${slug}" declare le trigger "${trigger}"`, () => {
        const effect = getSkillEffect(slug);
        expect(effect!.triggers).toContain(trigger);
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
    it('inclut les 3 skills du batch 3j', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-pass inclut on-the-ball et throw-team-mate', () => {
      const slugs = getSkillsForTrigger('on-pass').map((e) => e.slug);
      expect(slugs).toContain('on-the-ball');
      expect(slugs).toContain('throw-team-mate');
    });

    it('on-block-defender inclut dump-off', () => {
      const slugs = getSkillsForTrigger('on-block-defender').map((e) => e.slug);
      expect(slugs).toContain('dump-off');
    });
  });

  describe('canApply : strict sur le slug', () => {
    const basePlayer = {
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
    };
    const baseCtx = { player: basePlayer, state: {} as any };

    for (const { slug } of BATCH_SKILLS) {
      it(`"${slug}" : canApply = false sans le skill`, () => {
        const effect = getSkillEffect(slug)!;
        expect(effect.canApply(baseCtx as any)).toBe(false);
      });

      it(`"${slug}" : canApply = true avec le skill`, () => {
        const effect = getSkillEffect(slug)!;
        const ctx = {
          ...baseCtx,
          player: { ...basePlayer, skills: [slug] },
        };
        expect(effect.canApply(ctx as any)).toBe(true);
      });
    }
  });
});
