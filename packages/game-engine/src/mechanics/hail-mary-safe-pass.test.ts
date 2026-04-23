import { describe, it, expect } from 'vitest';
import { setup, applyMove } from '../index';
import { GameState, RNG, Move } from '../core/types';
import { canAttemptPassForRange, getPassRange } from './passing';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

function createHailMaryTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 2, y: 7 }, name: 'Thrower', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 8,
      skills: ['hail-mary-pass'],
      pm: 6, hasBall: true, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 22, y: 7 }, name: 'Receiver', number: 2,
      position: 'Catcher', ma: 8, st: 2, ag: 4, pa: 5, av: 7, skills: [],
      pm: 8, hasBall: false, state: 'active',
    },
  ];
  state.ball = undefined;
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

function createSafePassTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Thrower', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 8,
      skills: ['safe-pass'],
      pm: 6, hasBall: true, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 14, y: 7 }, name: 'Receiver', number: 2,
      position: 'Catcher', ma: 8, st: 2, ag: 4, pa: 5, av: 7, skills: [],
      pm: 8, hasBall: false, state: 'active',
    },
  ];
  state.ball = undefined;
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

describe('Regle: hail-mary-pass', () => {
  it('permet une passe au-dela de la portee Long Bomb quand le passeur a le skill', () => {
    const passer = {
      id: 'P', team: 'A' as const, pos: { x: 0, y: 0 }, name: 'Thrower', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 8,
      skills: ['hail-mary-pass'],
      pm: 6, hasBall: true, state: 'active' as const,
    };
    const range = getPassRange({ x: 0, y: 0 }, { x: 22, y: 7 });
    expect(range).toBeNull();
    expect(canAttemptPassForRange(passer, range)).toBe(true);
  });

  it('refuse la passe hors portee quand le passeur n\'a PAS hail-mary-pass', () => {
    const passer = {
      id: 'P', team: 'A' as const, pos: { x: 0, y: 0 }, name: 'Thrower', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [],
      pm: 6, hasBall: true, state: 'active' as const,
    };
    const range = getPassRange({ x: 0, y: 0 }, { x: 22, y: 7 });
    expect(canAttemptPassForRange(passer, range)).toBe(false);
  });

  it('sur un jet de passe reussi, ne donne PAS le ballon au receveur (passe non-precise) et ne cause pas de turnover', () => {
    const state = createHailMaryTestState();
    const rng = makeTestRNG([0.95, 0.5, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    const passer = result.players.find(p => p.id === 'A1')!;
    const receiver = result.players.find(p => p.id === 'A2')!;

    expect(passer.hasBall).toBe(false);
    expect(receiver.hasBall).toBe(false);
    expect(result.isTurnover).toBe(false);
  });

  it('sur un jet de passe rate, provoque un turnover comme une passe normale', () => {
    const state = createHailMaryTestState();
    const rng = makeTestRNG([0.01, 0.5, 0.5]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    expect(result.isTurnover).toBe(true);
  });
});

describe('Regle: safe-pass', () => {
  it('sur un jet de passe rate, le passeur garde le ballon et il n\'y a pas de turnover', () => {
    const state = createSafePassTestState();
    const rng = makeTestRNG([0.01, 0.5, 0.5]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    const passer = result.players.find(p => p.id === 'A1')!;
    const receiver = result.players.find(p => p.id === 'A2')!;

    expect(passer.hasBall).toBe(true);
    expect(receiver.hasBall).toBe(false);
    expect(result.isTurnover).toBe(false);
    expect(result.ball).toBeUndefined();
  });

  it('sur une passe reussie, se comporte normalement (receveur recoit le ballon)', () => {
    const state = createSafePassTestState();
    const rng = makeTestRNG([0.95, 0.95]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    const passer = result.players.find(p => p.id === 'A1')!;
    const receiver = result.players.find(p => p.id === 'A2')!;

    expect(passer.hasBall).toBe(false);
    expect(receiver.hasBall).toBe(true);
    expect(result.isTurnover).toBe(false);
  });

  it('marque l\'activation du passeur comme PASS (activation terminee apres safe-pass)', () => {
    const state = createSafePassTestState();
    const rng = makeTestRNG([0.01]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    expect(result.playerActions['A1']).toBe('PASS');
  });
});
