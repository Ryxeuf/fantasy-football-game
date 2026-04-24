import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3m — Registre de decouverte UI pour skills niche deja
 * implementes mecaniquement mais absents du `skill-registry`.
 *
 * Les mecaniques correspondantes existent deja :
 *  - `bloodlust`     -> mechanics/negative-traits.ts (checkBloodlust, cible 4+)
 *  - `bloodlust-2`   -> mechanics/negative-traits.ts (checkBloodlust, cible 2+)
 *  - `bloodlust-3`   -> mechanics/negative-traits.ts (checkBloodlust, cible 3+)
 *  - `always-hungry` -> mechanics/negative-traits.ts (declenche sur Throw Team-Mate)
 *  - `secret-weapon` -> mechanics/secret-weapons.ts (expulsion fin de drive)
 *
 * Sans entree dans le registre, `getSkillEffect(slug)` retournait `undefined`,
 * ce qui privait l'UI du catalogue (description) et empechait la decouverte
 * automatique par les composants qui iterent sur `getAllRegisteredSkills()`.
 *
 * Conformement au pattern des batchs 3g/3h/3i/3j/3k/3l, ce batch n'ajoute
 * AUCUNE logique moteur : les effets sont deja resolus par les handlers
 * dedies. En particulier, on n'expose pas de `getModifiers` pour ces skills
 * car ils declenchent des jets specifiques (D6 contre cible) plutot que
 * des modificateurs additionnels sur d'autres jets.
 */

type BatchTrigger = 'on-activation' | 'on-pass' | 'passive';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'bloodlust', trigger: 'on-activation' },
  { slug: 'bloodlust-2', trigger: 'on-activation' },
  { slug: 'bloodlust-3', trigger: 'on-activation' },
  { slug: 'always-hungry', trigger: 'on-pass' },
  { slug: 'secret-weapon', trigger: 'passive' },
];

describe('O.1 batch 3m — skill-registry discovery entries', () => {
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
    it('inclut les 5 skills du batch 3m', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-activation inclut les 3 variantes bloodlust', () => {
      const slugs = getSkillsForTrigger('on-activation').map((e) => e.slug);
      expect(slugs).toContain('bloodlust');
      expect(slugs).toContain('bloodlust-2');
      expect(slugs).toContain('bloodlust-3');
    });

    it('on-pass inclut always-hungry', () => {
      const slugs = getSkillsForTrigger('on-pass').map((e) => e.slug);
      expect(slugs).toContain('always-hungry');
    });

    it('passive inclut secret-weapon', () => {
      const slugs = getSkillsForTrigger('passive').map((e) => e.slug);
      expect(slugs).toContain('secret-weapon');
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

    it('"bloodlust" canApply ne se declenche pas pour les variantes -2/-3 seules', () => {
      const effect = getSkillEffect('bloodlust')!;
      const ctxWith2 = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['bloodlust-2'] },
      };
      const ctxWith3 = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['bloodlust-3'] },
      };
      // Les variantes ont leurs propres entrees registry pour eviter le
      // double-comptage : la canApply de "bloodlust" ne reagit qu'au slug
      // canonique.
      expect(effect.canApply(ctxWith2 as any)).toBe(false);
      expect(effect.canApply(ctxWith3 as any)).toBe(false);
    });
  });
});
