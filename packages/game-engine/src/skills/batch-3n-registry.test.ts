import { describe, it, expect } from 'vitest';
import {
  getSkillEffect,
  getAllRegisteredSkills,
  getSkillsForTrigger,
} from './skill-registry';

/**
 * O.1 batch 3n — Registre de decouverte UI pour skills niche deja
 * presents sur les rosters Season 3 mais absents du `skill-registry`.
 *
 * Skills couverts :
 *  - `pogo-stick`      -> mechanics/leap.ts (meme mecanique que Leap + 1 au jet)
 *  - `swarming`        -> regle de placement (depassement 11 joueurs autorise)
 *  - `kick-team-mate`  -> action speciale alternative a Throw Team-Mate
 *
 * Ces skills sont actuellement refuses par `getSkillEffect(slug)`, ce qui
 * masque leur description dans le catalogue UI et les exclut des
 * iterations sur `getAllRegisteredSkills()`. Conformement aux batches
 * 3g-3m, ce batch ajoute uniquement des entrees de decouverte et n'expose
 * AUCUN `getModifiers` : les mecaniques associees (leap, setup, action
 * speciale) sont deja resolues par des handlers dedies ou des regles de
 * placement, et dupliquer les modificateurs creerait un double-comptage.
 */

type BatchTrigger = 'on-setup' | 'on-movement' | 'on-activation' | 'passive';

interface BatchSkill {
  readonly slug: string;
  readonly trigger: BatchTrigger;
}

const BATCH_SKILLS: readonly BatchSkill[] = [
  { slug: 'pogo-stick', trigger: 'on-movement' },
  { slug: 'swarming', trigger: 'on-setup' },
  { slug: 'kick-team-mate', trigger: 'on-activation' },
];

describe('O.1 batch 3n — skill-registry discovery entries', () => {
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
    it('inclut les 3 skills du batch 3n', () => {
      const slugs = getAllRegisteredSkills().map((e) => e.slug);
      for (const { slug } of BATCH_SKILLS) {
        expect(slugs, `missing slug ${slug}`).toContain(slug);
      }
    });
  });

  describe('getSkillsForTrigger', () => {
    it('on-movement inclut pogo-stick', () => {
      const slugs = getSkillsForTrigger('on-movement').map((e) => e.slug);
      expect(slugs).toContain('pogo-stick');
    });

    it('on-setup inclut swarming', () => {
      const slugs = getSkillsForTrigger('on-setup').map((e) => e.slug);
      expect(slugs).toContain('swarming');
    });

    it('on-activation inclut kick-team-mate', () => {
      const slugs = getSkillsForTrigger('on-activation').map((e) => e.slug);
      expect(slugs).toContain('kick-team-mate');
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

    it('"pogo-stick" : canApply ne reagit pas au slug "leap" seul', () => {
      // pogo-stick et leap partagent la meme mecanique (leap.ts), mais
      // chacun recoit sa propre entree dans le registre pour permettre a
      // l'UI de differencier les deux et de refleter le +1 bonus du
      // pogo-stick.
      const effect = getSkillEffect('pogo-stick')!;
      const ctxWithLeap = {
        ...baseCtx,
        player: { ...basePlayer, skills: ['leap'] },
      };
      expect(effect.canApply(ctxWithLeap as any)).toBe(false);
    });
  });
});
