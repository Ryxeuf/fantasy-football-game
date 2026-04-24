import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3s — Registre de decouverte UI pour regles speciales de
 * star players presentes dans le catalogue mais absentes du
 * `skill-registry`.
 *
 * Skills couverts :
 *  - `blind-rage`             -> Trait Star : peut relancer le D6 pour
 *                                Intrepide (Dauntless).
 *  - `slayer`                 -> Trait Star : peut relancer les jets
 *                                d'Intrepide (Dauntless) rates.
 *  - `consummate-professional`-> Trait Star : une fois par match, peut
 *                                relancer n'importe quel de.
 *  - `crushing-blow`          -> Trait Star : une fois par match, +1 au
 *                                jet d'armure apres un blocage reussi.
 *  - `pirouette`              -> Trait Star : une fois par tour, +1 au
 *                                jet d'esquive.
 *  - `reliable`               -> Trait Star : un Lancer de Coequipier rate
 *                                ne cause pas de turnover.
 *
 * Conformement aux batches 3g-3r, ce batch ajoute uniquement des entrees
 * de decouverte et n'expose AUCUN `getModifiers` : les mecaniques
 * associees (relance passive, bonus ponctuel par match / par tour,
 * annulation de turnover TTM) sont resolues dans les handlers dedies
 * (dauntless handler, reroll manager, TTM handler). Dupliquer les
 * modificateurs ici creerait un double-comptage.
 */

type BatchTrigger =
  | 'on-block-attacker'
  | 'on-armor'
  | 'on-dodge'
  | 'on-pass'
  | 'passive';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'blind-rage', trigger: 'on-block-attacker' },
  { slug: 'slayer', trigger: 'on-block-attacker' },
  { slug: 'consummate-professional', trigger: 'passive' },
  { slug: 'crushing-blow', trigger: 'on-armor' },
  { slug: 'pirouette', trigger: 'on-dodge' },
  { slug: 'reliable', trigger: 'on-pass' },
];

describe('O.1 batch 3s — skill-registry discovery entries', () => {
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
    it('inclut les 6 skills du batch 3s', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-block-attacker inclut blind-rage et slayer', () => {
      const slugs = getSkillsForTrigger('on-block-attacker').map((e) => e.slug);
      expect(slugs).toContain('blind-rage');
      expect(slugs).toContain('slayer');
    });

    it('passive inclut consummate-professional', () => {
      const slugs = getSkillsForTrigger('passive').map((e) => e.slug);
      expect(slugs).toContain('consummate-professional');
    });

    it('on-armor inclut crushing-blow', () => {
      const slugs = getSkillsForTrigger('on-armor').map((e) => e.slug);
      expect(slugs).toContain('crushing-blow');
    });

    it('on-dodge inclut pirouette', () => {
      const slugs = getSkillsForTrigger('on-dodge').map((e) => e.slug);
      expect(slugs).toContain('pirouette');
    });

    it('on-pass inclut reliable', () => {
      const slugs = getSkillsForTrigger('on-pass').map((e) => e.slug);
      expect(slugs).toContain('reliable');
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

    it('"blind-rage" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('blind-rage')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['blind_rage'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"crushing-blow" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('crushing-blow')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['crushing_blow'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"consummate-professional" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('consummate-professional')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['consummate_professional'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });
  });
});
