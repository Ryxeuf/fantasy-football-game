import { describe, it, expect } from 'vitest';
import {
  hasShadowing,
  findShadowingCandidates,
  rollShadowing,
  tryApplyShadowing,
  resolveShadowingAfterDodge,
  type ShadowingResult,
} from './shadowing';
import type { Player, GameState, Position, RNG } from '../core/types';
import { setup } from '../core/game-state';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
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

// Make a deterministic RNG feeding the given d6 rolls (values 1..6).
// The RNG contract is () => number in [0, 1); Math.floor(rng() * 6) + 1 must equal the next value.
function makeSeededRng(d6rolls: number[]): RNG {
  let i = 0;
  return () => {
    const v = d6rolls[i++];
    if (v === undefined) {
      throw new Error('Ran out of seeded dice rolls');
    }
    // map face v in [1..6] back to r in [0,1) so that floor(r*6)+1 === v
    return (v - 1) / 6 + 0.01 / 6;
  };
}

describe('Règle: Shadowing - detection', () => {
  it('hasShadowing retourne true pour un joueur avec le skill', () => {
    const player = makePlayer({ skills: ['shadowing'] });
    expect(hasShadowing(player)).toBe(true);
  });

  it('hasShadowing retourne false sans le skill', () => {
    const player = makePlayer({ skills: [] });
    expect(hasShadowing(player)).toBe(false);
  });
});

describe('Règle: Shadowing - findShadowingCandidates', () => {
  it('retourne les adversaires adjacents à la case de départ ayant Shadowing', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 5, y: 5 } });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates.map((p) => p.id)).toEqual(['s1']);
  });

  it("ignore les adversaires sans le skill", () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 5, y: 5 } });
    const plain = makePlayer({ id: 'x1', team: 'B', pos: { x: 6, y: 5 }, skills: [] });
    const state = makeState([dodger, plain]);
    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates).toEqual([]);
  });

  it("ignore les coéquipiers même s'ils ont Shadowing", () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 5, y: 5 } });
    const mate = makePlayer({
      id: 'm1',
      team: 'A',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([dodger, mate]);
    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates).toEqual([]);
  });

  it("ignore les adversaires avec Shadowing qui ne sont pas adjacents à la case de départ", () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 5, y: 5 } });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 8, y: 8 },
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates).toEqual([]);
  });

  it("ignore les adversaires prone/stunned/KO/casualty", () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 5, y: 5 } });
    const stunned = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
      state: 'stunned',
    });
    const ko = makePlayer({
      id: 's2',
      team: 'B',
      pos: { x: 4, y: 5 },
      skills: ['shadowing'],
      state: 'knocked_out',
    });
    const casualty = makePlayer({
      id: 's3',
      team: 'B',
      pos: { x: 5, y: 6 },
      skills: ['shadowing'],
      state: 'casualty',
    });
    const state = makeState([dodger, stunned, ko, casualty]);
    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates).toEqual([]);
  });
});

describe('Règle: Shadowing - rollShadowing', () => {
  it('réussit si 2D6 + MA_shadower - MA_dodger >= 7', () => {
    const dodger = makePlayer({ id: 'd1', ma: 6 });
    const shadower = makePlayer({ id: 's1', team: 'B', ma: 6, skills: ['shadowing'] });
    // 2D6 = 4 + 3 = 7, MA diff = 0 → total 7 → success
    const rng = makeSeededRng([4, 3]);
    const result = rollShadowing(shadower, dodger, rng);
    expect(result.success).toBe(true);
    expect(result.total).toBe(7);
    expect(result.dice).toEqual([4, 3]);
    expect(result.target).toBe(7);
  });

  it('échoue si 2D6 + MA_shadower - MA_dodger < 7', () => {
    const dodger = makePlayer({ id: 'd1', ma: 7 });
    const shadower = makePlayer({ id: 's1', team: 'B', ma: 5, skills: ['shadowing'] });
    // 2D6 = 4 + 4 = 8, MA diff = -2 → total 6 → fail
    const rng = makeSeededRng([4, 4]);
    const result = rollShadowing(shadower, dodger, rng);
    expect(result.success).toBe(false);
    expect(result.total).toBe(6);
  });

  it('applique le différentiel de MA positif', () => {
    const dodger = makePlayer({ id: 'd1', ma: 4 });
    const shadower = makePlayer({ id: 's1', team: 'B', ma: 8, skills: ['shadowing'] });
    // 2D6 = 1 + 2 = 3, MA diff = +4 → total 7 → success
    const rng = makeSeededRng([1, 2]);
    const result = rollShadowing(shadower, dodger, rng);
    expect(result.success).toBe(true);
    expect(result.total).toBe(7);
  });
});

describe('Règle: Shadowing - tryApplyShadowing', () => {
  it('déplace le shadower sur la case laissée par le dodger en cas de succès', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 6,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    // 2D6 = 4 + 3 = 7 → success
    const rng = makeSeededRng([4, 3]);
    const vacated: Position = { x: 5, y: 5 };
    const result = tryApplyShadowing(state, dodger, shadower, vacated, rng);
    const updatedShadower = result.state.players.find((p) => p.id === 's1')!;
    expect(updatedShadower.pos).toEqual({ x: 5, y: 5 });
    expect(result.applied).toBe(true);
  });

  it('ne déplace pas le shadower en cas d\'échec', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 8 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 4,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    // 2D6 = 1 + 2 = 3, MA diff = -4 → total = -1 → fail
    const rng = makeSeededRng([1, 2]);
    const vacated: Position = { x: 5, y: 5 };
    const result = tryApplyShadowing(state, dodger, shadower, vacated, rng);
    const updatedShadower = result.state.players.find((p) => p.id === 's1')!;
    expect(updatedShadower.pos).toEqual({ x: 6, y: 5 });
    expect(result.applied).toBe(false);
  });

  it("n'altère pas le state d'origine (immutabilité)", () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 6,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    const rng = makeSeededRng([4, 3]);
    const originalShadowerPos = { ...state.players[1].pos };
    tryApplyShadowing(state, dodger, shadower, { x: 5, y: 5 }, rng);
    expect(state.players[1].pos).toEqual(originalShadowerPos);
  });

  it('ajoute une entrée de log lors de la tentative', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 6,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    const rng = makeSeededRng([4, 3]);
    const before = state.gameLog.length;
    const result = tryApplyShadowing(state, dodger, shadower, { x: 5, y: 5 }, rng);
    expect(result.state.gameLog.length).toBe(before + 1);
    const entry = result.state.gameLog[result.state.gameLog.length - 1];
    expect(entry.message.toLowerCase()).toContain('shadowing');
  });
});

describe('Règle: Shadowing - resolveShadowingAfterDodge', () => {
  it('ne fait rien s\'il n\'y a aucun candidat', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 } });
    const plain = makePlayer({ id: 'x1', team: 'B', pos: { x: 6, y: 5 } });
    const state = makeState([dodger, plain]);
    const before = state.gameLog.length;
    const rng: RNG = () => 0.5;
    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    expect(next.gameLog.length).toBe(before);
    expect(next.players[1].pos).toEqual({ x: 6, y: 5 });
  });

  it('s\'arrête dès qu\'un shadower a réussi à suivre', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 6 });
    const s1 = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 6,
      skills: ['shadowing'],
    });
    const s2 = makePlayer({
      id: 's2',
      team: 'B',
      pos: { x: 6, y: 6 },
      ma: 6,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, s1, s2]);
    // s1 rolls 4+3 = 7 → success. Loop stops, s2 does not roll.
    const rng = makeSeededRng([4, 3]);
    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    const updatedS1 = next.players.find((p) => p.id === 's1')!;
    const updatedS2 = next.players.find((p) => p.id === 's2')!;
    expect(updatedS1.pos).toEqual({ x: 5, y: 5 });
    expect(updatedS2.pos).toEqual({ x: 6, y: 6 });
  });

  it('laisse tenter plusieurs shadowers si les premiers échouent', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 9 });
    const s1 = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 4,
      skills: ['shadowing'],
    });
    const s2 = makePlayer({
      id: 's2',
      team: 'B',
      pos: { x: 6, y: 6 },
      ma: 9,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, s1, s2]);
    // s1: 2+2 = 4, + MA diff(-5) = -1 → fail.
    // s2: 4+3 = 7, + MA diff(0)  = 7 → success.
    const rng = makeSeededRng([2, 2, 4, 3]);
    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    const updatedS2 = next.players.find((p) => p.id === 's2')!;
    expect(updatedS2.pos).toEqual({ x: 5, y: 5 });
  });
});

describe('Règle: Shadowing - type ShadowingResult', () => {
  it('a la forme attendue (dice, total, target, success)', () => {
    const dodger = makePlayer({ id: 'd1', ma: 6 });
    const shadower = makePlayer({ id: 's1', team: 'B', ma: 6, skills: ['shadowing'] });
    const rng = makeSeededRng([4, 3]);
    const result: ShadowingResult = rollShadowing(shadower, dodger, rng);
    expect(Object.keys(result).sort()).toEqual(['dice', 'success', 'target', 'total']);
  });
});

describe('Règle: Shadowing - une seule tentative par poursuivant par tour (BB3)', () => {
  it('findShadowingCandidates exclut les joueurs ayant déjà tenté ce tour', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 5, y: 5 } });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    state.usedShadowingThisTurn = ['s1'];
    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates).toEqual([]);
  });

  it('findShadowingCandidates inclut les joueurs qui n\'ont pas encore tenté', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 5, y: 5 } });
    const s1 = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: ['shadowing'],
    });
    const s2 = makePlayer({
      id: 's2',
      team: 'B',
      pos: { x: 4, y: 5 },
      skills: ['shadowing'],
    });
    const state = makeState([dodger, s1, s2]);
    state.usedShadowingThisTurn = ['s1'];
    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates.map((p) => p.id)).toEqual(['s2']);
  });

  it('resolveShadowingAfterDodge enregistre le shadower dans usedShadowingThisTurn (succès)', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 6,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    // 2D6 = 4 + 3 = 7 → success
    const rng = makeSeededRng([4, 3]);
    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    expect(next.usedShadowingThisTurn).toContain('s1');
  });

  it('resolveShadowingAfterDodge enregistre le shadower dans usedShadowingThisTurn (échec)', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 9 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 4,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    // 2D6 = 1 + 2 = 3, MA diff = -5 → total = -2 → fail
    const rng = makeSeededRng([1, 2]);
    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    expect(next.usedShadowingThisTurn).toContain('s1');
  });

  it('un shadower ayant déjà tenté ne peut plus suivre un second dodger', () => {
    const dodger1 = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 6 });
    const dodger2 = makePlayer({ id: 'd2', team: 'A', pos: { x: 7, y: 6 }, ma: 6 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 6,
      skills: ['shadowing'],
    });
    const state = makeState([dodger1, dodger2, shadower]);
    // First dodge: s1 rolls 4+3 = 7 → success, moves to (5,5)
    const rng = makeSeededRng([4, 3]);
    const after1st = resolveShadowingAfterDodge(state, dodger1, { x: 5, y: 5 }, rng);
    expect(after1st.usedShadowingThisTurn).toContain('s1');

    // Second dodge by dodger2: s1 should NOT be a candidate even if adjacent
    // Move shadower to be adjacent to dodger2's vacated square for the test
    const stateForSecond: GameState = {
      ...after1st,
      players: after1st.players.map((p) =>
        p.id === 's1' ? { ...p, pos: { x: 6, y: 6 } } : p,
      ),
    };
    const rng2 = makeSeededRng([6, 6]); // Would succeed, but should not even roll
    const after2nd = resolveShadowingAfterDodge(stateForSecond, dodger2, { x: 5, y: 6 }, rng2);
    const updatedShadower = after2nd.players.find((p) => p.id === 's1')!;
    // Shadower should NOT have moved — already used Shadowing this turn
    expect(updatedShadower.pos).toEqual({ x: 6, y: 6 });
  });

  it('fonctionne normalement quand usedShadowingThisTurn est undefined (état legacy)', () => {
    const dodger = makePlayer({ id: 'd1', team: 'A', pos: { x: 7, y: 5 }, ma: 6 });
    const shadower = makePlayer({
      id: 's1',
      team: 'B',
      pos: { x: 6, y: 5 },
      ma: 6,
      skills: ['shadowing'],
    });
    const state = makeState([dodger, shadower]);
    // Ensure field is not set (legacy state)
    delete (state as Record<string, unknown>).usedShadowingThisTurn;
    const rng = makeSeededRng([4, 3]);
    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    const updatedShadower = next.players.find((p) => p.id === 's1')!;
    expect(updatedShadower.pos).toEqual({ x: 5, y: 5 });
    expect(next.usedShadowingThisTurn).toContain('s1');
  });
});
