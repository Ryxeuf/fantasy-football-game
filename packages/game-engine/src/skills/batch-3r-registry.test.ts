import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3r — Registre de decouverte UI pour skills niche presents
 * sur les rosters Season 3 mais absents du `skill-registry`.
 *
 * Skills couverts :
 *  - `breathe-fire`  -> Trait S3 : une fois par activation, au lieu d'un Bloc,
 *                       peut effectuer une action Speciale Souffle de Feu
 *                       (Slann Kroxigor, Black Orc Trained Troll variantes).
 *  - `clearance`     -> Competence Scelerate S3 : action Speciale de Degagement
 *                       utilisant le gabarit de renvois (1 par tour, peut
 *                       bouger avant, pas de Turnover ballon au sol).
 *  - `pile-on`       -> Trait BB2020 S3 : apres un bloc reussi, valdingue
 *                       possible + relance du jet d'atterrissage rate (Goblin
 *                       Fanatic variantes, Halfling Hefty).
 *  - `provocation`   -> Competence Scelerate S3 : quand ce joueur est Repousse
 *                       suite a un blocage contre lui, il peut forcer le
 *                       joueur adverse a Poursuivre (sauf si enracine).
 *  - `surefoot`      -> General S3 : chaque fois que ce joueur est cense etre
 *                       Plaque ou Chute, un D6 sur 6 l'empeche de tomber et
 *                       n'interrompt pas son activation.
 *  - `trickster`     -> Trait S3 : avant de determiner les des de bloc, le
 *                       defenseur peut etre replace sur n'importe quelle case
 *                       inoccupee adjacente au joueur attaquant.
 *
 * Conformement aux batches 3g-3q, ce batch ajoute uniquement des entrees de
 * decouverte et n'expose AUCUN `getModifiers` : les mecaniques associees
 * (action speciale alt-bloc, action de degagement, valdingue / relance
 * d'agilite, interdiction de poursuite, esquive passive de Chute,
 * re-placement defensif pre-bloc) sont resolues ou le seront dans des
 * batches dedies. Dupliquer les modificateurs ici creerait un
 * double-comptage.
 */

type BatchTrigger =
  | 'on-activation'
  | 'on-injury'
  | 'on-block-result'
  | 'on-movement'
  | 'on-block-defender';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'breathe-fire', trigger: 'on-activation' },
  { slug: 'clearance', trigger: 'on-activation' },
  { slug: 'pile-on', trigger: 'on-injury' },
  { slug: 'provocation', trigger: 'on-block-result' },
  { slug: 'surefoot', trigger: 'on-movement' },
  { slug: 'trickster', trigger: 'on-block-defender' },
];

describe('O.1 batch 3r — skill-registry discovery entries', () => {
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
    it('inclut les 6 skills du batch 3r', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-activation inclut breathe-fire et clearance', () => {
      const slugs = getSkillsForTrigger('on-activation').map((e) => e.slug);
      expect(slugs).toContain('breathe-fire');
      expect(slugs).toContain('clearance');
    });

    it('on-injury inclut pile-on', () => {
      const slugs = getSkillsForTrigger('on-injury').map((e) => e.slug);
      expect(slugs).toContain('pile-on');
    });

    it('on-block-result inclut provocation', () => {
      const slugs = getSkillsForTrigger('on-block-result').map((e) => e.slug);
      expect(slugs).toContain('provocation');
    });

    it('on-movement inclut surefoot', () => {
      const slugs = getSkillsForTrigger('on-movement').map((e) => e.slug);
      expect(slugs).toContain('surefoot');
    });

    it('on-block-defender inclut trickster', () => {
      const slugs = getSkillsForTrigger('on-block-defender').map((e) => e.slug);
      expect(slugs).toContain('trickster');
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

    it('"breathe-fire" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('breathe-fire')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['breathe_fire'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"pile-on" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('pile-on')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['pile_on'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });
  });
});
