import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3t — Registre de decouverte UI pour regles speciales Star
 * Player + competences Scelerate Season 3 presentes dans le catalogue
 * mais absentes du `skill-registry`.
 *
 * Skills couverts :
 *  - `stakes`               -> Trait Star : pieux benis, +1 Armure contre
 *                              Khemri / Necromantique / Mort-Vivant /
 *                              Vampire lors d'une attaque de Poignard.
 *  - `solitary-aggressor`   -> Scelerate S3 : relance Armure ratee quand
 *                              l'Agression est effectuee sans Soutien
 *                              Offensif ou Defensif.
 *  - `lightning-aggression` -> Scelerate S3 : l'activation ne prend pas
 *                              fin apres une Action d'Agression ; peut
 *                              continuer son mouvement restant.
 *  - `boot-to-the-head`     -> Scelerate S3 : peut fournir Soutien
 *                              Offensif pour l'Agression d'un coequipier,
 *                              quel que soit le nombre de joueurs adverses
 *                              qui le Marquent.
 *  - `violent-innovator`    -> Scelerate S3 : gagne les PSP d'Elimination
 *                              meme quand l'elimination est infligee via
 *                              une Action Speciale.
 *  - `saboteur`             -> Scelerate S3 : apres avoir ete Plaque,
 *                              peut faire exploser son arme sabotee
 *                              (D6 4+) pour Plaquer aussi l'adversaire.
 *
 * Conformement aux batches 3g-3s, ce batch ajoute uniquement des entrees
 * de decouverte et n'expose AUCUN `getModifiers` : les mecaniques
 * associees (bonus armure conditionnel au roster adverse, relance opt-in
 * conditionnelle, prolongation d'activation, soutien special, comptage
 * SPP, D6 explosion d'arme) sont resolues dans les handlers dedies.
 * Dupliquer les modificateurs ici creerait un double-comptage.
 */

type BatchTrigger = 'on-armor' | 'on-foul' | 'on-injury';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'stakes', trigger: 'on-armor' },
  { slug: 'solitary-aggressor', trigger: 'on-foul' },
  { slug: 'lightning-aggression', trigger: 'on-foul' },
  { slug: 'boot-to-the-head', trigger: 'on-foul' },
  { slug: 'violent-innovator', trigger: 'on-injury' },
  { slug: 'saboteur', trigger: 'on-armor' },
];

describe('O.1 batch 3t — skill-registry discovery entries', () => {
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
    it('inclut les 6 skills du batch 3t', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-armor inclut stakes et saboteur', () => {
      const slugs = getSkillsForTrigger('on-armor').map((e) => e.slug);
      expect(slugs).toContain('stakes');
      expect(slugs).toContain('saboteur');
    });

    it('on-foul inclut solitary-aggressor, lightning-aggression, boot-to-the-head', () => {
      const slugs = getSkillsForTrigger('on-foul').map((e) => e.slug);
      expect(slugs).toContain('solitary-aggressor');
      expect(slugs).toContain('lightning-aggression');
      expect(slugs).toContain('boot-to-the-head');
    });

    it('on-injury inclut violent-innovator', () => {
      const slugs = getSkillsForTrigger('on-injury').map((e) => e.slug);
      expect(slugs).toContain('violent-innovator');
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

    it('"solitary-aggressor" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('solitary-aggressor')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['solitary_aggressor'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"lightning-aggression" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('lightning-aggression')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['lightning_aggression'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"boot-to-the-head" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('boot-to-the-head')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['boot_to_the_head'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });

    it('"violent-innovator" : canApply reconnait aussi la variante underscore', () => {
      const effect = getSkillEffect('violent-innovator')!;
      const ctx = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['violent_innovator'] },
      };
      expect(effect.canApply(ctx as any)).toBe(true);
    });
  });
});
