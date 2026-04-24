import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3q — Registre de decouverte UI pour skills niche presents
 * sur les rosters Season 3 mais absents du `skill-registry`.
 *
 * Skills couverts :
 *  - `contagieux`    -> Trait Nurgle S3 : permet de transmettre une maladie ou
 *                       une infection aux joueurs adverses (Rotter, Bloater,
 *                       Rotspawn, Beast of Nurgle, Pestigor).
 *  - `fork`          -> Competition Scelerate S3 : quand un joueur adverse est
 *                       Repousse par ce joueur, il ne peut plus fournir de
 *                       Soutien Offensif ni Defensif jusqu'a la fin de sa
 *                       prochaine activation (Undead Zombie Lineman).
 *  - `hate`          -> Trait S3 "Haine (X)" : chaque fois que ce joueur
 *                       effectue une Action de Blocage contre un joueur ayant
 *                       le meme Mot-Cle que celui entre parentheses, il peut
 *                       relancer un resultat Attaquant Plaque (Dwarf Troll
 *                       Slayer, equivalents S3).
 *  - `insignifiant`  -> Trait S3 : lors de la construction de la liste
 *                       d'equipe, on ne peut pas inclure plus de joueurs avec
 *                       ce trait que de joueurs sans ce trait (Snotling
 *                       Lineman).
 *  - `pick-me-up`    -> Trait S3 : a la fin du tour d'equipe adverse, lance un
 *                       D6 pour chaque coequipier a Terre et non-Etourdi dans
 *                       les trois cases d'un joueur Debout avec ce trait
 *                       (Halfling Beer Boar, Rotspawn, Snotling Fun Hurler).
 *
 * Conformement aux batches 3g-3p, ce batch ajoute uniquement des entrees de
 * decouverte et n'expose AUCUN `getModifiers` : les mecaniques associees
 * (transmission de maladie, restriction de soutien apres push-back, reroll
 * cible sur blocage, validation de liste, relevement sur D6) sont resolues ou
 * le seront dans des batches dedies. Dupliquer les modificateurs ici creerait
 * un double-comptage.
 */

type BatchTrigger =
  | 'on-injury'
  | 'on-block-result'
  | 'on-block-attacker'
  | 'on-setup'
  | 'on-activation';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'contagieux', trigger: 'on-injury' },
  { slug: 'fork', trigger: 'on-block-result' },
  { slug: 'hate', trigger: 'on-block-attacker' },
  { slug: 'insignifiant', trigger: 'on-setup' },
  { slug: 'pick-me-up', trigger: 'on-activation' },
];

describe('O.1 batch 3q — skill-registry discovery entries', () => {
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
    it('inclut les 5 skills du batch 3q', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-injury inclut contagieux', () => {
      const slugs = getSkillsForTrigger('on-injury').map((e) => e.slug);
      expect(slugs).toContain('contagieux');
    });

    it('on-block-result inclut fork', () => {
      const slugs = getSkillsForTrigger('on-block-result').map((e) => e.slug);
      expect(slugs).toContain('fork');
    });

    it('on-block-attacker inclut hate', () => {
      const slugs = getSkillsForTrigger('on-block-attacker').map((e) => e.slug);
      expect(slugs).toContain('hate');
    });

    it('on-setup inclut insignifiant', () => {
      const slugs = getSkillsForTrigger('on-setup').map((e) => e.slug);
      expect(slugs).toContain('insignifiant');
    });

    it('on-activation inclut pick-me-up', () => {
      const slugs = getSkillsForTrigger('on-activation').map((e) => e.slug);
      expect(slugs).toContain('pick-me-up');
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

    it('"pick-me-up" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('pick-me-up')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['pick_me_up'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });
  });
});
