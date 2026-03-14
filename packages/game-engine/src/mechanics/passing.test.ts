import { describe, it, expect } from 'vitest';
import { setup, applyMove } from '../index';
import { GameState, RNG, Move } from '../core/types';
import { getPassRange, getDistance, calculatePassModifiers, findInterceptors } from './passing';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

function createPassTestState(): GameState {
  const state = setup();
  // Positionner les joueurs pour le test de passe
  // A1 au centre avec le ballon, A2 plus loin pour recevoir
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Passer', number: 1,
      position: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: [],
      pm: 6, hasBall: true, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 14, y: 7 }, name: 'Receiver', number: 2,
      position: 'Catcher', ma: 8, st: 2, ag: 4, pa: 5, av: 7, skills: [],
      pm: 8, hasBall: false, state: 'active',
    },
    {
      id: 'B1', team: 'B', pos: { x: 20, y: 7 }, name: 'Defender', number: 1,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
  ];
  state.ball = undefined; // A1 a le ballon
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

describe('Pass Distance', () => {
  it('calcule correctement les distances de Chebyshev', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe(3);
    expect(getDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    expect(getDistance({ x: 0, y: 0 }, { x: 10, y: 3 })).toBe(10);
  });

  it('détermine la bonne catégorie de passe', () => {
    expect(getPassRange({ x: 0, y: 0 }, { x: 2, y: 1 })).toBe('quick');
    expect(getPassRange({ x: 0, y: 0 }, { x: 5, y: 3 })).toBe('short');
    expect(getPassRange({ x: 0, y: 0 }, { x: 8, y: 5 })).toBe('long');
    expect(getPassRange({ x: 0, y: 0 }, { x: 12, y: 3 })).toBe('bomb');
    expect(getPassRange({ x: 0, y: 0 }, { x: 20, y: 10 })).toBeNull(); // Hors portée
  });
});

describe('Pass Action', () => {
  it('effectue une passe réussie (passe + réception)', () => {
    const state = createPassTestState();
    // RNG: pass roll = 5 (success pour PA 3, target ~3), catch roll = 5 (success pour AG 4)
    const rng = makeTestRNG([0.8, 0.8]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    // A1 ne doit plus avoir le ballon
    const passer = result.players.find(p => p.id === 'A1')!;
    expect(passer.hasBall).toBeFalsy();

    // A2 doit avoir le ballon
    const receiver = result.players.find(p => p.id === 'A2')!;
    expect(receiver.hasBall).toBe(true);

    // Pas de turnover
    expect(result.isTurnover).toBe(false);
  });

  it('turnover sur passe ratée', () => {
    const state = createPassTestState();
    // RNG: pass roll = 1 (échec), puis bounce ball
    const rng = makeTestRNG([0.01, 0.5, 0.5]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    // Turnover
    expect(result.isTurnover).toBe(true);

    // Personne ne devrait avoir le ballon (il a rebondi)
    const passer = result.players.find(p => p.id === 'A1')!;
    expect(passer.hasBall).toBeFalsy();
  });

  it('turnover sur réception ratée', () => {
    const state = createPassTestState();
    // RNG: pass roll = 6 (success), catch roll = 1 (échec), puis bounce
    const rng = makeTestRNG([0.95, 0.01, 0.5, 0.5]);

    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    // Turnover
    expect(result.isTurnover).toBe(true);
  });

  it('refuse la passe sans le ballon', () => {
    const state = createPassTestState();
    state.players[0].hasBall = false;
    state.ball = { x: 5, y: 5 };

    const rng = makeTestRNG([0.8]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    // L'état ne devrait pas changer
    expect(result).toEqual(state);
  });
});

describe('Interception', () => {
  it('trouve les intercepteurs sur la trajectoire', () => {
    const state = createPassTestState();
    // Placer un défenseur entre le passeur et le receveur
    state.players[2] = {
      id: 'B1', team: 'B', pos: { x: 12, y: 7 }, name: 'Interceptor', number: 1,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 6, hasBall: false, state: 'active',
    };

    const interceptors = findInterceptors(state, { x: 10, y: 7 }, { x: 14, y: 7 }, 'A');
    expect(interceptors).toHaveLength(1);
    expect(interceptors[0].id).toBe('B1');
  });

  it('ne trouve pas d\'intercepteur hors trajectoire', () => {
    const state = createPassTestState();
    // B1 est loin de la trajectoire
    const interceptors = findInterceptors(state, { x: 10, y: 7 }, { x: 14, y: 7 }, 'A');
    expect(interceptors).toHaveLength(0);
  });
});

describe('Handoff Action', () => {
  it('effectue une remise réussie', () => {
    const state = createPassTestState();
    // Placer A2 adjacent à A1
    state.players[1].pos = { x: 11, y: 7 };

    // RNG: catch roll = 5 (success pour AG 4)
    const rng = makeTestRNG([0.8]);

    const move: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    const passer = result.players.find(p => p.id === 'A1')!;
    expect(passer.hasBall).toBeFalsy();

    const receiver = result.players.find(p => p.id === 'A2')!;
    expect(receiver.hasBall).toBe(true);

    expect(result.isTurnover).toBe(false);
  });

  it('refuse la remise si la cible n\'est pas adjacente', () => {
    const state = createPassTestState();
    // A2 est à distance 4 (non adjacent)

    const rng = makeTestRNG([0.8]);
    const move: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    // L'état ne devrait pas changer
    expect(result).toEqual(state);
  });

  it('turnover sur réception de remise ratée', () => {
    const state = createPassTestState();
    state.players[1].pos = { x: 11, y: 7 };

    // RNG: catch roll = 1 (échec), puis bounce
    const rng = makeTestRNG([0.01, 0.5, 0.5]);

    const move: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    expect(result.isTurnover).toBe(true);
  });
});
