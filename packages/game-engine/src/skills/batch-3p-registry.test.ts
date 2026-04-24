import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3p — Registre de decouverte UI pour skills niche presents
 * sur les rosters Season 3 mais absents du `skill-registry`.
 *
 * Skills couverts :
 *  - `hit-and-run`   -> Agility skill S3 : mouvement supplementaire apres un
 *                       Bloc (Vampire Striker, Skaven Gutter Runner Hit Squad)
 *  - `my-ball`       -> Trait S3 : interdit d'abandonner volontairement le
 *                       ballon (Halfling Beer Boar)
 *  - `plague-ridden` -> Trait S3 : remplace une blessure MORT sur un joueur
 *                       St<=4 par une infection (roster Nurgle, Rotters, Beast
 *                       of Nurgle, Pestigor)
 *
 * Conformement aux batches 3g-3o, ce batch ajoute uniquement des entrees de
 * decouverte et n'expose AUCUN `getModifiers` : les mecaniques associees
 * (action speciale post-bloc, restriction de passe, conversion de blessure)
 * sont deja resolues ou le seront dans un batch dedie. Dupliquer les
 * modificateurs ici creerait un double-comptage.
 */

type BatchTrigger = 'on-movement' | 'on-pass' | 'on-injury';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'hit-and-run', trigger: 'on-movement' },
  { slug: 'my-ball', trigger: 'on-pass' },
  { slug: 'plague-ridden', trigger: 'on-injury' },
];

describe('O.1 batch 3p — skill-registry discovery entries', () => {
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

      it(`le skill "${slug}" n'expose pas getModifiers (evite double-comptage)`, () => {
        const effect = getSkillEffect(slug);
        expect(effect!.getModifiers).toBeUndefined();
      });
    }
  });

  describe('getAllRegisteredSkills', () => {
    it('inclut les 3 skills du batch 3p', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-movement inclut hit-and-run', () => {
      const slugs = getSkillsForTrigger('on-movement').map((e) => e.slug);
      expect(slugs).toContain('hit-and-run');
    });

    it('on-pass inclut my-ball', () => {
      const slugs = getSkillsForTrigger('on-pass').map((e) => e.slug);
      expect(slugs).toContain('my-ball');
    });

    it('on-injury inclut plague-ridden', () => {
      const slugs = getSkillsForTrigger('on-injury').map((e) => e.slug);
      expect(slugs).toContain('plague-ridden');
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

      it(`"${slug}" : canApply = true avec le skill canonique`, () => {
        const effect = getSkillEffect(slug)!;
        const ctx = {
          ...baseCtx,
          player: { ...basePlayer, skills: [slug] },
        };
        expect(effect.canApply(ctx as any)).toBe(true);
      });
    }

    it('"hit-and-run" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('hit-and-run')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['hit_and_run'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"my-ball" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('my-ball')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['my_ball'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"plague-ridden" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('plague-ridden')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['plague_ridden'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });
  });
});
