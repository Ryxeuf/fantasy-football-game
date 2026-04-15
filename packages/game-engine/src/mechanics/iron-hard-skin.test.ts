/**
 * Tests d'intégration pour le trait Iron Hard Skin (P1.7).
 *
 * Règle BB3 Season 2/3 : quand un jet d'armure est effectué contre un joueur
 * possédant Iron Hard Skin, l'adversaire ne peut pas appliquer les effets de
 * ses propres Skills, Traits, Special Rules, Star Player Qualities ou
 * Prayers to Nuffle qui s'ajouteraient à ce jet.
 *
 * Concrètement : Claws, Mighty Blow (sur armure), Dirty Player (sur faute),
 * Chainsaw (+3) sont neutralisés quand la cible possède Iron Hard Skin.
 * Mighty Blow reste applicable au jet de BLESSURE (la règle ne concerne que
 * le jet d'armure).
 */

import { describe, it, expect } from 'vitest';
import type { GameState, Player, RNG } from '../core/types';
import { setup } from '../core/game-state';
import { executeStab } from './stab';
import { executeProjectileVomit } from './projectile-vomit';
import { executeFoul } from './foul';
import { executeChainsaw } from './chainsaw';
import { getArmorSkillContext } from '../skills/skill-bridge';

/**
 * Construit une RNG déterministe à partir de valeurs flottantes.
 * Pour un résultat de dé D voulu : passer (D-1)/6 ≤ v < D/6.
 * Convention : 0.0 → 1, 0.17 → 2, 0.34 → 3, 0.5 → 4, 0.67 → 5, 0.84 → 6.
 */
function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

/** Conversion lisible : valeur de dé → float RNG. */
function die(n: 1 | 2 | 3 | 4 | 5 | 6): number {
  // On vise milieu de l'intervalle pour éviter les arrondis en bord.
  return (n - 1) / 6 + 0.01;
}

function basePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Player',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 9,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function makeState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

describe('Règle: Iron Hard Skin (P1.7)', () => {
  describe('getArmorSkillContext', () => {
    it('reporte ironHardSkinActive=false pour un joueur sans Iron Hard Skin', () => {
      const attacker = basePlayer({ id: 'att' });
      const defender = basePlayer({ id: 'def', team: 'B' });
      const state = makeState([attacker, defender]);
      const ctx = getArmorSkillContext(state, attacker, defender);
      expect(ctx.ironHardSkinActive).toBe(false);
    });

    it('reporte ironHardSkinActive=true pour un joueur avec Iron Hard Skin', () => {
      const attacker = basePlayer({ id: 'att' });
      const defender = basePlayer({
        id: 'def', team: 'B', skills: ['iron-hard-skin'],
      });
      const state = makeState([attacker, defender]);
      const ctx = getArmorSkillContext(state, attacker, defender);
      expect(ctx.ironHardSkinActive).toBe(true);
    });

    it('reconnaît la variante avec underscore iron_hard_skin', () => {
      const attacker = basePlayer({ id: 'att' });
      const defender = basePlayer({
        id: 'def', team: 'B', skills: ['iron_hard_skin'],
      });
      const state = makeState([attacker, defender]);
      const ctx = getArmorSkillContext(state, attacker, defender);
      expect(ctx.ironHardSkinActive).toBe(true);
    });
  });

  describe('Stab vs Iron Hard Skin', () => {
    it('nullifie le bonus Mighty Blow du Stabber sur le jet d\'armure', () => {
      // 2D6 = 4+4 = 8 ; AV 9.
      // Sans MB : armure tient (8 < 9). Avec MB : armure percée (8 ≥ 8).
      // IHS doit forcer "armure tient".
      const stabber = basePlayer({
        id: 'att', pos: { x: 5, y: 5 }, team: 'A',
        skills: ['stab', 'mighty-blow'],
      });
      const defender = basePlayer({
        id: 'def', pos: { x: 6, y: 5 }, team: 'B',
        av: 9, skills: ['iron-hard-skin'],
      });
      const state = makeState([stabber, defender]);
      const rng = makeTestRNG([die(4), die(4), die(1), die(1)]);
      const after = executeStab(state, stabber, defender, rng);
      const defAfter = after.players.find(p => p.id === 'def')!;
      expect(defAfter.state).toBe('active');
      expect(defAfter.stunned).toBeFalsy();
      // Sanity : le log doit mentionner Iron Hard Skin.
      const log = after.gameLog.map(l => l.message).join('\n');
      expect(log).toContain('Iron Hard Skin');
    });

    it('laisse passer Mighty Blow contre une cible sans Iron Hard Skin (régression)', () => {
      const stabber = basePlayer({
        id: 'att', pos: { x: 5, y: 5 }, team: 'A',
        skills: ['stab', 'mighty-blow'],
      });
      const defender = basePlayer({
        id: 'def', pos: { x: 6, y: 5 }, team: 'B', av: 9, skills: [],
      });
      const state = makeState([stabber, defender]);
      // 4+4 = 8, -1 (MB) → target 8 ≤ 8 = percée. Injury 6+6 → casualty.
      const rng = makeTestRNG([die(4), die(4), die(6), die(6), die(6), die(6)]);
      const after = executeStab(state, stabber, defender, rng);
      const defAfter = after.players.find(p => p.id === 'def')!;
      expect(defAfter.state !== 'active' || defAfter.stunned).toBeTruthy();
    });
  });

  describe('Projectile Vomit vs Iron Hard Skin', () => {
    it('nullifie le bonus Mighty Blow du vomisseur sur le jet d\'armure', () => {
      const vomiter = basePlayer({
        id: 'att', pos: { x: 5, y: 5 }, team: 'A',
        skills: ['projectile-vomit', 'mighty-blow'],
      });
      const defender = basePlayer({
        id: 'def', pos: { x: 6, y: 5 }, team: 'B',
        av: 9, skills: ['iron-hard-skin'],
      });
      const state = makeState([vomiter, defender]);
      // D6 vomit = 4 (succès, 2+), puis 2D6 armure = 4+4 = 8, target 9 (IHS) → tient.
      const rng = makeTestRNG([die(4), die(4), die(4)]);
      const after = executeProjectileVomit(state, vomiter, defender, rng);
      const defAfter = after.players.find(p => p.id === 'def')!;
      // Cible mise à terre par le Vomit (succès), mais armure tient donc pas de blessure.
      expect(defAfter.stunned).toBe(true);
      expect(defAfter.state).toBe('active');
    });
  });

  describe('Faute vs Iron Hard Skin', () => {
    it('nullifie le bonus Dirty Player sur le jet d\'armure d\'une faute', () => {
      const fouler = basePlayer({
        id: 'att', pos: { x: 5, y: 5 }, team: 'A',
        skills: ['dirty-player-1'],
      });
      const victim = basePlayer({
        id: 'def', pos: { x: 6, y: 5 }, team: 'B',
        av: 9, skills: ['iron-hard-skin'],
        stunned: true, pm: 0,
      });
      const state = makeState([fouler, victim]);
      // 2D6 = 4+4 = 8 ; sans DP sous IHS, 8 < 9 → armure tient.
      const rng = makeTestRNG([die(4), die(4), die(1), die(1)]);
      const after = executeFoul(state, fouler, victim, rng);
      const defAfter = after.players.find(p => p.id === 'def')!;
      expect(defAfter.state).toBe('active');
    });

    it('laisse passer Dirty Player sans Iron Hard Skin (régression)', () => {
      const fouler = basePlayer({
        id: 'att', pos: { x: 5, y: 5 }, team: 'A',
        skills: ['dirty-player-1'],
      });
      const victim = basePlayer({
        id: 'def', pos: { x: 6, y: 5 }, team: 'B',
        av: 9, skills: [],
        stunned: true, pm: 0,
      });
      const state = makeState([fouler, victim]);
      // 2D6 = 4+4 = 8 + 1 DP = 9 ≥ 9 → armure percée ; injury 6+6 → casualty.
      const rng = makeTestRNG([die(4), die(4), die(6), die(6), die(6), die(6)]);
      const after = executeFoul(state, fouler, victim, rng);
      const defAfter = after.players.find(p => p.id === 'def')!;
      expect(defAfter.state !== 'active' || defAfter.stunned).toBeTruthy();
    });
  });

  describe('Chainsaw vs Iron Hard Skin', () => {
    it('nullifie le bonus +3 de Chainsaw sur le jet d\'armure de la cible', () => {
      const sawyer = basePlayer({
        id: 'att', pos: { x: 5, y: 5 }, team: 'A',
        skills: ['chainsaw'],
      });
      const defender = basePlayer({
        id: 'def', pos: { x: 6, y: 5 }, team: 'B',
        av: 9, skills: ['iron-hard-skin'],
      });
      const state = makeState([sawyer, defender]);
      // 2D6 = 3+3 = 6 ; sans +3 sous IHS, 6 < 9 → armure tient.
      const rng = makeTestRNG([die(3), die(3), die(1), die(1)]);
      const after = executeChainsaw(state, sawyer, defender, rng);
      const defAfter = after.players.find(p => p.id === 'def')!;
      expect(defAfter.state).toBe('active');
      expect(defAfter.stunned).toBeFalsy();
    });

    it('laisse passer le +3 de Chainsaw sans Iron Hard Skin (régression)', () => {
      const sawyer = basePlayer({
        id: 'att', pos: { x: 5, y: 5 }, team: 'A',
        skills: ['chainsaw'],
      });
      const defender = basePlayer({
        id: 'def', pos: { x: 6, y: 5 }, team: 'B', av: 9, skills: [],
      });
      const state = makeState([sawyer, defender]);
      // 2D6 = 3+3 = 6 + 3 = 9 ≥ 9 → armure percée ; injury 6+6 → casualty.
      const rng = makeTestRNG([die(3), die(3), die(6), die(6), die(6), die(6)]);
      const after = executeChainsaw(state, sawyer, defender, rng);
      const defAfter = after.players.find(p => p.id === 'def')!;
      expect(defAfter.state !== 'active' || defAfter.stunned).toBeTruthy();
    });
  });
});
