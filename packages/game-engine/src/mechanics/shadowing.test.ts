import { describe, it, expect } from 'vitest';
import {
  hasShadowing,
  hasUsedShadowingThisTurn,
  markShadowingUsed,
  getShadowingCandidates,
  rollShadowingCheck,
  computeShadowingSuccess,
  applyShadowingOnDodge,
  findShadowerForSquare,
} from './shadowing';
import type { Player, GameState, RNG } from '../core/types';
import { setup } from '../core/game-state';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
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
  return state;
}

// Deterministic RNG builder: returns successive values in [0, 1). Provide dice
// 1..6 by passing (value - 0.5) / 6 so that Math.floor(rng() * 6) + 1 === value.
function rngFromDice(dice: number[]): RNG {
  const values = dice.map(d => (d - 0.5) / 6);
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

describe('Regle: Shadowing - detection', () => {
  it('hasShadowing retourne true pour un joueur avec le skill', () => {
    const player = makePlayer({ skills: ['shadowing'] });
    expect(hasShadowing(player)).toBe(true);
  });

  it('hasShadowing retourne false sans le skill', () => {
    const player = makePlayer({ skills: [] });
    expect(hasShadowing(player)).toBe(false);
  });

  it('hasShadowing ignore les joueurs sans skill meme adjacents', () => {
    const player = makePlayer({ skills: ['dodge', 'tackle'] });
    expect(hasShadowing(player)).toBe(false);
  });
});

describe('Regle: Shadowing - candidats adjacents', () => {
  it('getShadowingCandidates retourne les adversaires adjacents avec shadowing', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 } });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
    });
    const nonShadower = makePlayer({
      id: 'nshadow',
      team: 'B',
      pos: { x: 4, y: 5 },
      skills: [],
    });
    const state = makeState([mover, shadower, nonShadower]);
    const candidates = getShadowingCandidates(state, mover);
    expect(candidates.map(p => p.id)).toEqual(['shadow']);
  });

  it('getShadowingCandidates ignore les allies adjacents', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 } });
    const ally = makePlayer({
      id: 'ally',
      team: 'A',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([mover, ally]);
    expect(getShadowingCandidates(state, mover)).toEqual([]);
  });

  it('getShadowingCandidates ignore les adversaires non-adjacents', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 } });
    const distant = makePlayer({
      id: 'distant',
      team: 'B',
      pos: { x: 8, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([mover, distant]);
    expect(getShadowingCandidates(state, mover)).toEqual([]);
  });

  it('getShadowingCandidates ignore les joueurs stunned / hypnotises', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 } });
    const stunned = makePlayer({
      id: 'stun',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
      stunned: true,
    });
    const hypno = makePlayer({
      id: 'hypno',
      team: 'B',
      pos: { x: 4, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([mover, stunned, hypno]);
    state.hypnotizedPlayers = ['hypno'];
    expect(getShadowingCandidates(state, mover)).toEqual([]);
  });

  it('getShadowingCandidates exclut ceux qui ont deja utilise Shadowing ce tour', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 } });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([mover, shadower]);
    state.usedShadowingThisTurn = ['shadow'];
    expect(getShadowingCandidates(state, mover)).toEqual([]);
  });
});

describe('Regle: Shadowing - test de 2D6 + MA shadower - MA cible', () => {
  it('succes sur 7+', () => {
    // Shadower MA 7, cible MA 6, 2D6 => (3+3) = 6 => 6 + 7 - 6 = 7 => succes
    const rng = rngFromDice([3, 3]);
    const res = rollShadowingCheck({ shadowerMa: 7, targetMa: 6, rng });
    expect(res.diceRoll).toBe(6);
    expect(res.total).toBe(7);
    expect(res.success).toBe(true);
  });

  it('echec sous 7', () => {
    const rng = rngFromDice([1, 2]);
    const res = rollShadowingCheck({ shadowerMa: 6, targetMa: 6, rng });
    expect(res.diceRoll).toBe(3);
    expect(res.total).toBe(3);
    expect(res.success).toBe(false);
  });

  it('cible plus rapide reduit les chances', () => {
    // 2D6 max = 12 ; si shadower MA 4, target MA 9 -> max = 12 + 4 - 9 = 7 (succes seulement sur 12)
    const rng6 = rngFromDice([6, 6]);
    const resMax = rollShadowingCheck({ shadowerMa: 4, targetMa: 9, rng: rng6 });
    expect(resMax.total).toBe(7);
    expect(resMax.success).toBe(true);

    const rng11 = rngFromDice([6, 5]);
    const res11 = rollShadowingCheck({ shadowerMa: 4, targetMa: 9, rng: rng11 });
    expect(res11.total).toBe(6);
    expect(res11.success).toBe(false);
  });

  it('computeShadowingSuccess retourne la meme logique sans dependance RNG', () => {
    expect(computeShadowingSuccess({ diceTotal: 7, shadowerMa: 6, targetMa: 6 })).toBe(true);
    expect(computeShadowingSuccess({ diceTotal: 6, shadowerMa: 6, targetMa: 6 })).toBe(false);
    // Shadower MA 8 vs target MA 4 : 3 + 8 - 4 = 7 => succes
    expect(computeShadowingSuccess({ diceTotal: 3, shadowerMa: 8, targetMa: 4 })).toBe(true);
  });
});

describe('Regle: Shadowing - tracking once-per-turn', () => {
  it('markShadowingUsed ajoute l\'id au tableau', () => {
    const shadower = makePlayer({ id: 's1', skills: ['shadowing'] });
    const state = makeState([shadower]);
    expect(hasUsedShadowingThisTurn(state, 's1')).toBe(false);
    const next = markShadowingUsed(state, 's1');
    expect(hasUsedShadowingThisTurn(next, 's1')).toBe(true);
  });

  it('markShadowingUsed est immuable (ne mute pas l\'input)', () => {
    const shadower = makePlayer({ id: 's1', skills: ['shadowing'] });
    const state = makeState([shadower]);
    const next = markShadowingUsed(state, 's1');
    expect(state.usedShadowingThisTurn).toBeUndefined();
    expect(next.usedShadowingThisTurn).toEqual(['s1']);
  });

  it('markShadowingUsed est idempotent pour le meme joueur', () => {
    const shadower = makePlayer({ id: 's1', skills: ['shadowing'] });
    const state = makeState([shadower]);
    const once = markShadowingUsed(state, 's1');
    const twice = markShadowingUsed(once, 's1');
    expect(twice.usedShadowingThisTurn).toEqual(['s1']);
  });
});

describe('Regle: Shadowing - findShadowerForSquare', () => {
  it('retourne le premier shadower adjacent a la case quittee', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 10, y: 10 } });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 9, y: 10 },
      skills: ['shadowing'],
    });
    const state = makeState([mover, shadower]);
    const found = findShadowerForSquare(state, { x: 10, y: 10 }, 'A');
    expect(found?.id).toBe('shadow');
  });

  it('retourne null s\'il n\'y a aucun shadower adjacent', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 10, y: 10 } });
    const opponent = makePlayer({
      id: 'opp',
      team: 'B',
      pos: { x: 9, y: 10 },
      skills: [],
    });
    const state = makeState([mover, opponent]);
    expect(findShadowerForSquare(state, { x: 10, y: 10 }, 'A')).toBeNull();
  });
});

describe('Regle: Shadowing - applyShadowingOnDodge (integration)', () => {
  it('ne fait rien si aucun shadower adjacent', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 } });
    const state = makeState([mover]);
    const rng = rngFromDice([6, 6]);
    const res = applyShadowingOnDodge(state, mover, { x: 5, y: 5 }, { x: 6, y: 5 }, rng);
    expect(res.state).toBe(state);
    expect(res.shadowed).toBe(false);
  });

  it('succes: deplace le shadower sur la case quittee et marque used', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
      ma: 7,
    });
    const state = makeState([mover, shadower]);
    // 2D6 = 6 ; 6 + 7 - 6 = 7 => succes
    const rng = rngFromDice([3, 3]);
    const res = applyShadowingOnDodge(state, mover, { x: 5, y: 5 }, { x: 6, y: 6 }, rng);

    expect(res.shadowed).toBe(true);
    const shadowerAfter = res.state.players.find(p => p.id === 'shadow');
    expect(shadowerAfter?.pos).toEqual({ x: 5, y: 5 });
    expect(res.state.usedShadowingThisTurn).toContain('shadow');
  });

  it('echec: ne deplace pas le shadower mais marque used (tentative consommee)', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
      ma: 6,
    });
    const state = makeState([mover, shadower]);
    // 2D6 = 3 ; 3 + 6 - 6 = 3 => echec
    const rng = rngFromDice([1, 2]);
    const res = applyShadowingOnDodge(state, mover, { x: 5, y: 5 }, { x: 6, y: 6 }, rng);

    expect(res.shadowed).toBe(false);
    const shadowerAfter = res.state.players.find(p => p.id === 'shadow');
    expect(shadowerAfter?.pos).toEqual({ x: 6, y: 5 });
    expect(res.state.usedShadowingThisTurn).toContain('shadow');
  });

  it('ne declenche pas si la case quittee est deja occupee (suivi impossible)', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 }, ma: 6 });
    const blocker = makePlayer({
      id: 'blocker',
      team: 'B',
      pos: { x: 5, y: 5 }, // meme case (n'arrivera pas en pratique, mais couvre l'edge case)
      skills: [],
    });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
      ma: 9,
    });
    const state = makeState([mover, blocker, shadower]);
    // Simulate: the square remains occupied by `blocker` after mover leaves
    // -> shadowing should not move into an occupied square
    const rng = rngFromDice([6, 6]);
    const res = applyShadowingOnDodge(
      state,
      mover,
      { x: 5, y: 5 },
      { x: 6, y: 6 },
      rng,
      { occupantIds: ['blocker'] },
    );
    expect(res.shadowed).toBe(false);
    // shadower stays put
    expect(res.state.players.find(p => p.id === 'shadow')?.pos).toEqual({ x: 6, y: 5 });
    // No attempt was consumed because we bail out before the roll
    expect(res.state.usedShadowingThisTurn ?? []).not.toContain('shadow');
  });

  it('respecte le once-per-turn', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
      ma: 8,
    });
    const state = makeState([mover, shadower]);
    state.usedShadowingThisTurn = ['shadow'];
    const rng = rngFromDice([6, 6]);
    const res = applyShadowingOnDodge(state, mover, { x: 5, y: 5 }, { x: 6, y: 6 }, rng);

    expect(res.shadowed).toBe(false);
    expect(res.state.players.find(p => p.id === 'shadow')?.pos).toEqual({ x: 6, y: 5 });
  });

  it('ecrit un log du jet dans gameLog', () => {
    const mover = makePlayer({ id: 'mover', team: 'A', pos: { x: 5, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 'shadow',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
      ma: 7,
    });
    const state = makeState([mover, shadower]);
    const rng = rngFromDice([3, 3]);
    const res = applyShadowingOnDodge(state, mover, { x: 5, y: 5 }, { x: 6, y: 6 }, rng);

    const logs = res.state.gameLog.filter(l => l.message.toLowerCase().includes('shadowing'));
    expect(logs.length).toBeGreaterThan(0);
  });
});
