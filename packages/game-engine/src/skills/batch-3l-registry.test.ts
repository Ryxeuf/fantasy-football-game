import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3l — Registre de decouverte UI pour skills niche deja
 * implementes mecaniquement mais absents du `skill-registry`.
 *
 * Les mecaniques correspondantes existent deja :
 *  - `armored-skull` -> mechanics/injury.ts (modificateur -1 au jet de blessure)
 *  - `instable`      -> mechanics/negative-traits.ts (interdit Pass/Handoff/TTM)
 *  - `running-pass`  -> mechanics/running-pass.ts (continue mouvement apres Quick Pass)
 *
 * Sans entree dans le registre, `getSkillEffect(slug)` retournait `undefined`,
 * ce qui privait l'UI du catalogue (description) et empechait la decouverte
 * automatique par les composants qui iterent sur `getAllRegisteredSkills()`.
 *
 * Conformement au pattern des batchs 3g/3h/3i/3j/3k, ce batch n'ajoute AUCUNE
 * logique moteur : les effets sont deja resolus par les handlers dedies. En
 * particulier, on n'expose pas de `getModifiers` pour `armored-skull` car le
 * -1 est deja applique directement dans `performInjuryRoll` ; l'exposer ici
 * provoquerait un double-comptage via `getInjurySkillModifiers`.
 */

type BatchTrigger = 'on-injury' | 'passive' | 'on-pass';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
  readonly aliasSlugs?: readonly string[];
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'armored-skull', trigger: 'on-injury' },
  { slug: 'instable', trigger: 'passive' },
  {
    slug: 'running-pass',
    trigger: 'on-pass',
    aliasSlugs: ['running_pass', 'running-pass-2025'],
  },
];

describe('O.1 batch 3l — skill-registry discovery entries', () => {
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
    it('inclut les 3 skills du batch 3l', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-injury inclut armored-skull', () => {
      const slugs = getSkillsForTrigger('on-injury').map((e) => e.slug);
      expect(slugs).toContain('armored-skull');
    });

    it('passive inclut instable', () => {
      const slugs = getSkillsForTrigger('passive').map((e) => e.slug);
      expect(slugs).toContain('instable');
    });

    it('on-pass inclut running-pass', () => {
      const slugs = getSkillsForTrigger('on-pass').map((e) => e.slug);
      expect(slugs).toContain('running-pass');
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

    for (const { slug, aliasSlugs } of BATCH_SKILLS) {
      if (!aliasSlugs) continue;
      for (const alias of aliasSlugs) {
        it(`"${slug}" : canApply = true avec l'alias "${alias}"`, () => {
          const effect = getSkillEffect(slug)!;
          const ctx = {
            ...baseCtx,
            player: { ...basePlayer, skills: [alias] },
          };
          expect(effect.canApply(ctx as any)).toBe(true);
        });
      }
    }
  });
});
