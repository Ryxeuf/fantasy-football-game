import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3u — Registre de decouverte UI pour les dernieres regles
 * speciales Star Player + competences Scelerate S3 niche presentes dans
 * le catalogue mais absentes du `skill-registry`. Ce batch cloture la
 * sous-tache O.1 (batch 3) en couvrant les 6 derniers skills non
 * enregistres.
 *
 * Skills couverts :
 *  - `bullseye`      -> Trait S3 Force : lors d'un Lancer de Coequipier
 *                       avec un Lancer Superbe, le joueur lance ne
 *                       Valdingue pas et atterrit sur la case ciblee.
 *  - `casse-os`      -> Trait Star : une fois par match, +1 en Force
 *                       lors d'une Action de Blocage.
 *  - `coup-sauvage`  -> Trait Star : une fois par partie, peut relancer
 *                       n'importe quel nombre de des de Blocage.
 *  - `la-baliste`    -> Trait Star : une fois par match, peut relancer
 *                       un jet de Passe (Passe ou Lancer de Coequipier) rate.
 *  - `lord-of-chaos` -> Trait Star : l'equipe gagne +1 Relance d'Equipe
 *                       pour la premiere mi-temps.
 *  - `fatal-flight`  -> Scelerate S3 : Lancer de Coequipier — si le
 *                       joueur lance atterrit ou rebondit sur une case
 *                       occupee et plaque l'adversaire, +1 Armure/Blessure
 *                       et SPP d'Elimination le cas echeant.
 *
 * Conformement aux batches 3g-3t, ce batch ajoute uniquement des entrees
 * de decouverte et n'expose AUCUN `getModifiers` : les mecaniques
 * associees (annulation valdingue TTM, bonus ponctuel Force, relance
 * dice-pool, relance passe, +1 Relance d'Equipe initiale, bonus
 * armure/blessure conditionnel post-TTM) sont resolues dans les
 * handlers dedies. Dupliquer les modificateurs ici creerait un
 * double-comptage.
 */

type BatchTrigger =
  | 'on-pass'
  | 'on-block-attacker'
  | 'on-kickoff'
  | 'on-armor';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'bullseye', trigger: 'on-pass' },
  { slug: 'casse-os', trigger: 'on-block-attacker' },
  { slug: 'coup-sauvage', trigger: 'on-block-attacker' },
  { slug: 'la-baliste', trigger: 'on-pass' },
  { slug: 'lord-of-chaos', trigger: 'on-kickoff' },
  { slug: 'fatal-flight', trigger: 'on-armor' },
];

describe('O.1 batch 3u — skill-registry discovery entries', () => {
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
    it('inclut les 6 skills du batch 3u', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-pass inclut bullseye et la-baliste', () => {
      const slugs = getSkillsForTrigger('on-pass').map((e) => e.slug);
      expect(slugs).toContain('bullseye');
      expect(slugs).toContain('la-baliste');
    });

    it('on-block-attacker inclut casse-os et coup-sauvage', () => {
      const slugs = getSkillsForTrigger('on-block-attacker').map((e) => e.slug);
      expect(slugs).toContain('casse-os');
      expect(slugs).toContain('coup-sauvage');
    });

    it('on-kickoff inclut lord-of-chaos', () => {
      const slugs = getSkillsForTrigger('on-kickoff').map((e) => e.slug);
      expect(slugs).toContain('lord-of-chaos');
    });

    it('on-armor inclut fatal-flight', () => {
      const slugs = getSkillsForTrigger('on-armor').map((e) => e.slug);
      expect(slugs).toContain('fatal-flight');
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

    it('"casse-os" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('casse-os')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['casse_os'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"coup-sauvage" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('coup-sauvage')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['coup_sauvage'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"la-baliste" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('la-baliste')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['la_baliste'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"lord-of-chaos" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('lord-of-chaos')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['lord_of_chaos'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"fatal-flight" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('fatal-flight')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['fatal_flight'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });
  });
});
