import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3o — Registre de decouverte UI pour skills niche deja
 * presents sur les rosters Season 3 (Treeman Halfling, Norse Lineman,
 * Elven Union Lineman) mais absents du `skill-registry`.
 *
 * Skills couverts :
 *  - `drunkard`       -> -1 au jet de Foncer (Norse Lineman, Bertha Bigfist...)
 *  - `timmm-ber`      -> bonus pour se relever si MA<=2 + allies adjacents
 *                        (Treeman Halfling / roster Halfling)
 *  - `fumblerooskie`  -> action speciale : lacher le ballon dans une case
 *                        quittee pendant un mouvement (Elven Union Lineman)
 *
 * Conformement aux batches 3g-3n, ce batch ajoute uniquement des entrees de
 * decouverte et n'expose AUCUN `getModifiers` : les mecaniques associees
 * (GFI, relevement, action speciale Fumblerooskie) sont deja resolues par
 * des handlers dedies ou le seront dans un batch ulterieur. Dupliquer les
 * modificateurs ici creerait un double-comptage.
 */

type BatchTrigger = 'on-gfi' | 'on-activation' | 'on-movement';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'drunkard', trigger: 'on-gfi' },
  { slug: 'timmm-ber', trigger: 'on-activation' },
  { slug: 'fumblerooskie', trigger: 'on-movement' },
];

describe('O.1 batch 3o — skill-registry discovery entries', () => {
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
    it('inclut les 3 skills du batch 3o', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-gfi inclut drunkard', () => {
      const slugs = getSkillsForTrigger('on-gfi').map((e) => e.slug);
      expect(slugs).toContain('drunkard');
    });

    it('on-activation inclut timmm-ber', () => {
      const slugs = getSkillsForTrigger('on-activation').map((e) => e.slug);
      expect(slugs).toContain('timmm-ber');
    });

    it('on-movement inclut fumblerooskie', () => {
      const slugs = getSkillsForTrigger('on-movement').map((e) => e.slug);
      expect(slugs).toContain('fumblerooskie');
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

    it('"timmm-ber" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('timmm-ber')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['timmm_ber'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });
  });
});
