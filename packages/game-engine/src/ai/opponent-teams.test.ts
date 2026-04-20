import { describe, it, expect } from 'vitest';
import { makeRNG } from '../utils/rng';
import {
  PRIORITY_TEAM_ROSTERS,
  type PriorityTeamRoster,
} from '../rosters/priority-teams';
import {
  AI_OPPONENT_ALLOWED_ROSTERS,
  isAIOpponentRosterAllowed,
  listAIOpponentAllowedRosters,
  pickAIOpponentRoster,
  type AIOpponentRoster,
} from './opponent-teams';

/**
 * N.4b — IA contrainte aux 5 equipes prioritaires dans un premier temps.
 *
 * La liste d'equipes jouables par l'IA est un sous-ensemble strict des rosters
 * disponibles : seules les 5 equipes du MVP (Skaven, Gnomes, Hommes-Lezards,
 * Nains, Noblesse Imperiale) peuvent etre affectees a un adversaire controle
 * par l'IA. Tout contournement doit echouer fermement pour preserver l'UX du
 * mode pratique (N.4).
 */
describe('N.4b — whitelist rosters IA adversaire', () => {
  describe('AI_OPPONENT_ALLOWED_ROSTERS', () => {
    it('contient exactement les 5 equipes prioritaires', () => {
      expect(AI_OPPONENT_ALLOWED_ROSTERS).toHaveLength(5);
      expect([...AI_OPPONENT_ALLOWED_ROSTERS].sort()).toEqual(
        [...PRIORITY_TEAM_ROSTERS].sort(),
      );
    });

    it('reste aligne sur PRIORITY_TEAM_ROSTERS (meme ordre roadmap)', () => {
      expect(AI_OPPONENT_ALLOWED_ROSTERS).toEqual(PRIORITY_TEAM_ROSTERS);
    });

    it('est gele (immutabilite au runtime)', () => {
      expect(Object.isFrozen(AI_OPPONENT_ALLOWED_ROSTERS)).toBe(true);
    });

    it('listAIOpponentAllowedRosters retourne la meme liste', () => {
      expect(listAIOpponentAllowedRosters()).toBe(AI_OPPONENT_ALLOWED_ROSTERS);
    });
  });

  describe('isAIOpponentRosterAllowed', () => {
    it.each(PRIORITY_TEAM_ROSTERS)(
      'autorise le roster prioritaire "%s"',
      slug => {
        expect(isAIOpponentRosterAllowed(slug)).toBe(true);
      },
    );

    it.each([
      'orc',
      'chaos_renegade',
      'nurgle',
      'vampire',
      'goblin',
      'wood_elf',
      'amazon',
      'human',
      'norse',
      'undead',
      'underworld',
      'ogre',
      'halfling',
      'khorne',
      'unknown-team',
      '',
      'SKAVEN',
      'Skaven',
    ])('rejette le roster non prioritaire "%s"', slug => {
      expect(isAIOpponentRosterAllowed(slug)).toBe(false);
    });

    it('sert de type guard pour PriorityTeamRoster', () => {
      const slug: string = 'skaven';
      if (isAIOpponentRosterAllowed(slug)) {
        const typed: AIOpponentRoster = slug;
        expect(typed).toBe('skaven');
      } else {
        throw new Error('skaven doit etre autorise');
      }
    });
  });

  describe('pickAIOpponentRoster', () => {
    it('retourne toujours un roster autorise (sans RNG)', () => {
      const chosen = pickAIOpponentRoster();
      expect(chosen).not.toBeNull();
      expect(isAIOpponentRosterAllowed(chosen as string)).toBe(true);
    });

    it('retourne toujours un roster autorise avec RNG seede', () => {
      for (let i = 0; i < 20; i++) {
        const rng = makeRNG(`pick-${i}`);
        const chosen = pickAIOpponentRoster({ rng });
        expect(chosen).not.toBeNull();
        expect(isAIOpponentRosterAllowed(chosen as string)).toBe(true);
      }
    });

    it('meme seed => meme choix (reproductibilite)', () => {
      const a = pickAIOpponentRoster({ rng: makeRNG('seed-abc') });
      const b = pickAIOpponentRoster({ rng: makeRNG('seed-abc') });
      expect(a).toEqual(b);
    });

    it('seeds differents produisent au moins deux choix distincts sur 50 tirages', () => {
      const choices = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const roster = pickAIOpponentRoster({ rng: makeRNG(`diverse-${i}`) });
        if (roster) choices.add(roster);
      }
      expect(choices.size).toBeGreaterThan(1);
    });

    it('respecte le parametre exclude', () => {
      const excluded: PriorityTeamRoster = 'skaven';
      for (let i = 0; i < 30; i++) {
        const rng = makeRNG(`exclude-${i}`);
        const chosen = pickAIOpponentRoster({ rng, exclude: [excluded] });
        expect(chosen).not.toBeNull();
        expect(chosen).not.toBe(excluded);
        expect(isAIOpponentRosterAllowed(chosen as string)).toBe(true);
      }
    });

    it('ignore les exclusions hors whitelist sans effet de bord', () => {
      const chosen = pickAIOpponentRoster({
        rng: makeRNG('ignore-unknown'),
        exclude: ['unknown-team', 'orc', ''],
      });
      expect(chosen).not.toBeNull();
      expect(isAIOpponentRosterAllowed(chosen as string)).toBe(true);
    });

    it('retourne null quand toutes les equipes sont exclues', () => {
      const chosen = pickAIOpponentRoster({
        rng: makeRNG('all-excluded'),
        exclude: PRIORITY_TEAM_ROSTERS,
      });
      expect(chosen).toBeNull();
    });

    it('permet d enchainer 2 tirages sans duplicate via exclude', () => {
      const rng = makeRNG('chain');
      const first = pickAIOpponentRoster({ rng });
      expect(first).not.toBeNull();
      const second = pickAIOpponentRoster({
        rng,
        exclude: first ? [first] : [],
      });
      expect(second).not.toBeNull();
      expect(second).not.toBe(first);
    });
  });
});
