import { describe, it, expect } from 'vitest';
import { setup } from '../index';
import type { GameState, Player, RNG } from '../core/types';
import {
  canTriggerOnTheBall,
  getOnTheBallReactivePlayers,
  getOnTheBallReachableSquares,
  executeOnTheBallMove,
  hasUsedOnTheBallThisTurn,
  markOnTheBallUsed,
  resetOnTheBallUsage,
} from './on-the-ball';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

/**
 * Convertit une valeur cible D6 en valeur RNG produisant ce roll.
 * rollD6 = floor(rng * 6) + 1. Pour value V, on renvoie (V-1)/6 + 0.01.
 */
function d6(value: number): number {
  return (value - 1) / 6 + 0.01;
}

function basePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'X',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: ['on-the-ball'],
    pm: 6,
    hasBall: false,
    state: 'active',
    ...overrides,
  };
}

function buildState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  return state;
}

describe('Regle: on-the-ball — eligibilite', () => {
  it('canTriggerOnTheBall renvoie false si pas le skill', () => {
    const p = basePlayer({ id: 'P1', skills: [] });
    const state = buildState([p]);
    expect(canTriggerOnTheBall(state, p)).toBe(false);
  });

  it('canTriggerOnTheBall renvoie true si le joueur a le skill, debout, actif', () => {
    const p = basePlayer({ id: 'P1' });
    const state = buildState([p]);
    expect(canTriggerOnTheBall(state, p)).toBe(true);
  });

  it('canTriggerOnTheBall renvoie false si le joueur est stunne', () => {
    const p = basePlayer({ id: 'P1', stunned: true });
    const state = buildState([p]);
    expect(canTriggerOnTheBall(state, p)).toBe(false);
  });

  it("canTriggerOnTheBall renvoie false si le joueur n'est pas actif (KO, casualty, sent_off)", () => {
    const ko = basePlayer({ id: 'P1', state: 'knocked_out' });
    const cas = basePlayer({ id: 'P2', state: 'casualty' });
    const sent = basePlayer({ id: 'P3', state: 'sent_off' });
    const state = buildState([ko, cas, sent]);
    expect(canTriggerOnTheBall(state, ko)).toBe(false);
    expect(canTriggerOnTheBall(state, cas)).toBe(false);
    expect(canTriggerOnTheBall(state, sent)).toBe(false);
  });

  it("canTriggerOnTheBall renvoie false si l'equipe a deja utilise on-the-ball ce tour", () => {
    const p = basePlayer({ id: 'P1' });
    const state = buildState([p]);
    const used = markOnTheBallUsed(state, 'A');
    expect(canTriggerOnTheBall(used, p)).toBe(false);
  });

  it("canTriggerOnTheBall renvoie true pour l'autre equipe meme si la premiere a utilise", () => {
    const pA = basePlayer({ id: 'A1', team: 'A' });
    const pB = basePlayer({ id: 'B1', team: 'B', pos: { x: 10, y: 10 } });
    const state = buildState([pA, pB]);
    const used = markOnTheBallUsed(state, 'A');
    expect(canTriggerOnTheBall(used, pA)).toBe(false);
    expect(canTriggerOnTheBall(used, pB)).toBe(true);
  });
});

describe('Regle: on-the-ball — reactive players list', () => {
  it("liste les joueurs adverses eligibles uniquement", () => {
    const a1 = basePlayer({ id: 'A1', team: 'A' }); // active = A, eligible si team B reagit
    const a2 = basePlayer({ id: 'A2', team: 'A', skills: [] });
    const b1 = basePlayer({ id: 'B1', team: 'B', pos: { x: 10, y: 5 } });
    const b2 = basePlayer({ id: 'B2', team: 'B', pos: { x: 11, y: 5 }, skills: [] });
    const b3 = basePlayer({ id: 'B3', team: 'B', pos: { x: 12, y: 5 }, stunned: true });
    const state = buildState([a1, a2, b1, b2, b3]);

    // Quand l'equipe A est active, on cherche les reactives de B
    const reactives = getOnTheBallReactivePlayers(state, 'A');
    expect(reactives.map(p => p.id)).toEqual(['B1']);
  });

  it("retourne liste vide si l'equipe reagissante a deja utilise on-the-ball", () => {
    const a1 = basePlayer({ id: 'A1', team: 'A' });
    const b1 = basePlayer({ id: 'B1', team: 'B', pos: { x: 10, y: 5 } });
    const state = buildState([a1, b1]);
    const used = markOnTheBallUsed(state, 'B');
    expect(getOnTheBallReactivePlayers(used, 'A')).toEqual([]);
  });
});

describe('Regle: on-the-ball — reachable squares', () => {
  it('retourne les cases dans un rayon Chebyshev de 3, hors case du joueur', () => {
    const p = basePlayer({ id: 'P1', pos: { x: 12, y: 7 } });
    const state = buildState([p]);
    const reachable = getOnTheBallReachableSquares(state, p);
    // Toutes les cases dans un carre 7x7 centre sur (12,7) sauf (12,7) lui-meme
    // = 49 - 1 = 48 cases (sous reserve qu'aucune ne soit occupee ni hors-bord)
    expect(reachable.length).toBeGreaterThan(0);
    expect(reachable).not.toContainEqual({ x: 12, y: 7 });
    expect(reachable).toContainEqual({ x: 15, y: 7 });
    expect(reachable).toContainEqual({ x: 9, y: 4 });
  });

  it("exclut les cases hors du terrain", () => {
    const p = basePlayer({ id: 'P1', pos: { x: 0, y: 0 } });
    const state = buildState([p]);
    const reachable = getOnTheBallReachableSquares(state, p);
    expect(reachable.every(pos => pos.x >= 0 && pos.y >= 0)).toBe(true);
    expect(reachable.every(pos => pos.x < state.width && pos.y < state.height)).toBe(true);
  });

  it('exclut les cases occupees par un autre joueur', () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 } });
    const blocker = basePlayer({ id: 'P2', pos: { x: 6, y: 5 }, skills: [] });
    const state = buildState([p, blocker]);
    const reachable = getOnTheBallReachableSquares(state, p);
    expect(reachable).not.toContainEqual({ x: 6, y: 5 });
    expect(reachable).toContainEqual({ x: 7, y: 5 });
  });

  it('peut etre filtree par cible (cases adjacentes ou identiques a la cible)', () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 } });
    const state = buildState([p]);
    const target = { x: 7, y: 5 };
    const reachable = getOnTheBallReachableSquares(state, p, target);
    // Doit etre adjacent (Chebyshev <= 1) a (7,5)
    for (const pos of reachable) {
      const dx = Math.abs(pos.x - target.x);
      const dy = Math.abs(pos.y - target.y);
      expect(Math.max(dx, dy)).toBeLessThanOrEqual(1);
    }
    // Cases attendues : (6,4), (6,5), (6,6), (7,4), (7,5), (7,6), (8,4), (8,5), (8,6)
    expect(reachable).toContainEqual({ x: 7, y: 5 });
    expect(reachable).toContainEqual({ x: 6, y: 4 });
    expect(reachable).toContainEqual({ x: 8, y: 6 });
  });

  it("respecte le maxSquares parametre (Chebyshev) — 1 case", () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 } });
    const state = buildState([p]);
    const reachable = getOnTheBallReachableSquares(state, p, undefined, 1);
    // 8 cases adjacentes max
    expect(reachable.length).toBeLessThanOrEqual(8);
    for (const pos of reachable) {
      const dx = Math.abs(pos.x - 5);
      const dy = Math.abs(pos.y - 5);
      expect(Math.max(dx, dy)).toBe(1);
    }
  });
});

describe('Regle: on-the-ball — execute move', () => {
  it('deplace le joueur a la destination si dodge non requis', () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 }, ag: 4 });
    const state = buildState([p]);
    const rng = makeRNG([0.9]);
    const next = executeOnTheBallMove(state, 'P1', { x: 7, y: 5 }, rng);
    const moved = next.players.find(pl => pl.id === 'P1');
    expect(moved?.pos).toEqual({ x: 7, y: 5 });
    expect(next.isTurnover).toBe(false);
  });

  it("marque l'equipe comme ayant utilise on-the-ball ce tour", () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 }, team: 'B' });
    const state = buildState([p]);
    const rng = makeRNG([0.9]);
    const next = executeOnTheBallMove(state, 'P1', { x: 7, y: 5 }, rng);
    expect(hasUsedOnTheBallThisTurn(next, 'B')).toBe(true);
    expect(hasUsedOnTheBallThisTurn(next, 'A')).toBe(false);
  });

  it('refuse le mouvement si destination hors de portee', () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 } });
    const state = buildState([p]);
    const rng = makeRNG([0.9]);
    const next = executeOnTheBallMove(state, 'P1', { x: 12, y: 5 }, rng);
    const moved = next.players.find(pl => pl.id === 'P1');
    expect(moved?.pos).toEqual({ x: 5, y: 5 }); // pas bouge
    expect(hasUsedOnTheBallThisTurn(next, 'A')).toBe(false);
  });

  it('refuse le mouvement si le joueur ne peut pas declencher (deja utilise)', () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 } });
    const state = markOnTheBallUsed(buildState([p]), 'A');
    const rng = makeRNG([0.9]);
    const next = executeOnTheBallMove(state, 'P1', { x: 7, y: 5 }, rng);
    const moved = next.players.find(pl => pl.id === 'P1');
    expect(moved?.pos).toEqual({ x: 5, y: 5 });
  });

  it("dodge requis (depart d'une zone de tacle) — succes : joueur deplace", () => {
    // P1 sur (5,5) avec on-the-ball, ag=4
    // Adversaire OPP en (6,5) — zone de tacle sur P1
    // Destination (4,5) — sortie de zone de tacle requise → dodge
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 }, ag: 4 });
    const opp = basePlayer({ id: 'OPP', team: 'B', pos: { x: 6, y: 5 }, skills: [] });
    const state = buildState([p, opp]);
    // ag=4 → dodge target = AG - mods. base mod = +1 (Dodge BB3) - 1 (1 adversaire) = 0
    // target = 4 - 0 = 4. roll 5 = succes
    const rng = makeRNG([d6(5)]);
    const next = executeOnTheBallMove(state, 'P1', { x: 4, y: 5 }, rng);
    const moved = next.players.find(pl => pl.id === 'P1');
    expect(moved?.pos).toEqual({ x: 4, y: 5 });
    expect(next.isTurnover).toBe(false);
  });

  it("dodge requis — echec : joueur prone a la destination, pas de turnover", () => {
    const p = basePlayer({ id: 'P1', pos: { x: 5, y: 5 }, ag: 2 });
    const opp = basePlayer({ id: 'OPP', team: 'B', pos: { x: 6, y: 5 }, skills: [] });
    const state = buildState([p, opp]);
    // ag=2, mod = 0 (1 adv, +1 BB3). target = 2. roll 1 = echec automatique
    const rng = makeRNG([d6(1), 0.5, 0.5]); // 1 = dodge fail, puis armor/injury
    const next = executeOnTheBallMove(state, 'P1', { x: 4, y: 5 }, rng);
    // Pas de turnover (reaction, pas activation du joueur)
    expect(next.isTurnover).toBe(false);
    // L'equipe a quand meme utilise on-the-ball
    expect(hasUsedOnTheBallThisTurn(next, 'A')).toBe(true);
  });
});

describe('Regle: on-the-ball — usage tracking', () => {
  it('hasUsedOnTheBallThisTurn renvoie false par defaut', () => {
    const p = basePlayer({ id: 'P1' });
    const state = buildState([p]);
    expect(hasUsedOnTheBallThisTurn(state, 'A')).toBe(false);
    expect(hasUsedOnTheBallThisTurn(state, 'B')).toBe(false);
  });

  it('markOnTheBallUsed est immuable', () => {
    const p = basePlayer({ id: 'P1' });
    const state = buildState([p]);
    const next = markOnTheBallUsed(state, 'A');
    expect(state.usedOnTheBallThisTurn).toBeUndefined();
    expect(next.usedOnTheBallThisTurn).toContain('A');
  });

  it("markOnTheBallUsed est idempotent", () => {
    const p = basePlayer({ id: 'P1' });
    const state = buildState([p]);
    const once = markOnTheBallUsed(state, 'A');
    const twice = markOnTheBallUsed(once, 'A');
    expect(twice.usedOnTheBallThisTurn).toEqual(['A']);
  });

  it('resetOnTheBallUsage efface la liste', () => {
    const p = basePlayer({ id: 'P1' });
    const state = buildState([p]);
    const used = markOnTheBallUsed(markOnTheBallUsed(state, 'A'), 'B');
    const reset = resetOnTheBallUsage(used);
    expect(reset.usedOnTheBallThisTurn).toEqual([]);
  });
});
