/**
 * Tests unitaires pour le trait Always Hungry (Toujours Affamé) — BB2020/BB3.
 *
 * Regle : lorsque ce joueur tente de lancer un coequipier, jet D6 AVANT le jet
 * de passe.
 *   - 2+  : le lancer se deroule normalement.
 *   - 1   : tentative de devorer le coequipier, nouveau jet D6.
 *           - 2+ : le coequipier s'echappe, place au sol (stunned) dans sa
 *             case actuelle, TURNOVER, aucun lancer effectue.
 *           - 1  : le coequipier est devore (casualty Dead), TURNOVER.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../index';
import { GameState, RNG } from '../core/types';
import { checkAlwaysHungry } from './negative-traits';

/**
 * Deterministe : retourne la prochaine valeur (0..1 exclu) sequentiellement.
 * Pour obtenir un roll D6 = N, passer (N-1)/6 + epsilon.
 */
function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/** rng val that yields a D6 roll of `n` via Math.floor(rng()*6)+1 */
function d6(n: number): number {
  // n in 1..6 → rng returns (n-1)/6 + small epsilon
  return (n - 1) / 6 + 0.01;
}

function createAlwaysHungryState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1',
      team: 'A',
      pos: { x: 10, y: 7 },
      name: 'Troll',
      number: 1,
      position: 'Troll',
      ma: 4,
      st: 5,
      ag: 5,
      pa: 5,
      av: 10,
      skills: ['throw-team-mate', 'always-hungry'],
      pm: 2,
      hasBall: false,
      state: 'active',
    },
    {
      id: 'A2',
      team: 'A',
      pos: { x: 11, y: 7 },
      name: 'Snotling',
      number: 2,
      position: 'Snotling',
      ma: 5,
      st: 1,
      ag: 3,
      pa: 6,
      av: 5,
      skills: ['right-stuff', 'stunty'],
      pm: 5,
      hasBall: false,
      state: 'active',
    },
  ];
  state.ball = { x: 5, y: 7 };
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamBlitzCount = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

describe("Regle: Always Hungry (Toujours Affame)", () => {
  it("ne fait rien si le lanceur n'a pas le trait always-hungry", () => {
    const state = createAlwaysHungryState();
    state.players = state.players.map(p =>
      p.id === 'A1' ? { ...p, skills: ['throw-team-mate'] } : p,
    );
    const thrower = state.players.find(p => p.id === 'A1')!;
    const thrown = state.players.find(p => p.id === 'A2')!;

    const rng: RNG = makeTestRNG([d6(1), d6(1)]); // would be worst case
    const result = checkAlwaysHungry(state, thrower, thrown, rng);

    expect(result.shouldContinueThrow).toBe(true);
    expect(result.newState).toBe(state); // no state change
  });

  it("le lancer continue normalement quand le D6 est 2+ (pas affame)", () => {
    const state = createAlwaysHungryState();
    const thrower = state.players.find(p => p.id === 'A1')!;
    const thrown = state.players.find(p => p.id === 'A2')!;

    // Roll = 2 → success (2+)
    const rng: RNG = makeTestRNG([d6(2)]);
    const result = checkAlwaysHungry(state, thrower, thrown, rng);

    expect(result.shouldContinueThrow).toBe(true);
    // pas de turnover
    expect(result.newState.isTurnover).toBeFalsy();
    // le coequipier reste debout
    const a2 = result.newState.players.find(p => p.id === 'A2')!;
    expect(a2.state).toBe('active');
    expect(a2.stunned).toBeFalsy();
    // un log du jet doit avoir ete ajoute
    const hungryLog = result.newState.gameLog.find(l =>
      l.message.toLowerCase().includes('toujours affam'),
    );
    expect(hungryLog).toBeDefined();
  });

  it("sur un 1 puis 2+ : le coequipier s'echappe (stunned, turnover, pas de lancer)", () => {
    const state = createAlwaysHungryState();
    const thrower = state.players.find(p => p.id === 'A1')!;
    const thrown = state.players.find(p => p.id === 'A2')!;
    const originalPos = { ...thrown.pos };

    // First roll = 1 (hungry), second roll = 4 (escape)
    const rng: RNG = makeTestRNG([d6(1), d6(4)]);
    const result = checkAlwaysHungry(state, thrower, thrown, rng);

    expect(result.shouldContinueThrow).toBe(false);
    expect(result.newState.isTurnover).toBe(true);

    const a2 = result.newState.players.find(p => p.id === 'A2')!;
    expect(a2.stunned).toBe(true);
    // Le coequipier reste sur le terrain (pas casualty)
    expect(a2.state).toBe('active');
    // Position inchangee (place dans sa case)
    expect(a2.pos).toEqual(originalPos);

    // Le lanceur n'est pas affecte
    const a1 = result.newState.players.find(p => p.id === 'A1')!;
    expect(a1.stunned).toBeFalsy();
    expect(a1.state).toBe('active');
  });

  it("sur un double 1 : le coequipier est devore (casualty dead, turnover)", () => {
    const state = createAlwaysHungryState();
    const thrower = state.players.find(p => p.id === 'A1')!;
    const thrown = state.players.find(p => p.id === 'A2')!;

    const rng: RNG = makeTestRNG([d6(1), d6(1)]);
    const result = checkAlwaysHungry(state, thrower, thrown, rng);

    expect(result.shouldContinueThrow).toBe(false);
    expect(result.newState.isTurnover).toBe(true);

    const a2 = result.newState.players.find(p => p.id === 'A2')!;
    expect(a2.state).toBe('casualty');
    expect(result.newState.casualtyResults?.[a2.id]).toBe('dead');
    // Le coequipier est retire du terrain (dugout)
    expect(a2.pos.x).toBeLessThan(0);

    const deadLog = result.newState.gameLog.find(l =>
      l.message.toLowerCase().includes('devor') ||
      l.message.toLowerCase().includes('mang'),
    );
    expect(deadLog).toBeDefined();
  });

  it("utilise le RNG seede (jets reproductibles)", () => {
    const state1 = createAlwaysHungryState();
    const state2 = createAlwaysHungryState();
    const thrower1 = state1.players.find(p => p.id === 'A1')!;
    const thrown1 = state1.players.find(p => p.id === 'A2')!;
    const thrower2 = state2.players.find(p => p.id === 'A1')!;
    const thrown2 = state2.players.find(p => p.id === 'A2')!;

    const rng1 = makeTestRNG([d6(1), d6(4)]);
    const rng2 = makeTestRNG([d6(1), d6(4)]);

    const r1 = checkAlwaysHungry(state1, thrower1, thrown1, rng1);
    const r2 = checkAlwaysHungry(state2, thrower2, thrown2, rng2);

    expect(r1.shouldContinueThrow).toBe(r2.shouldContinueThrow);
    expect(r1.newState.isTurnover).toBe(r2.newState.isTurnover);
    const a2_1 = r1.newState.players.find(p => p.id === 'A2')!;
    const a2_2 = r2.newState.players.find(p => p.id === 'A2')!;
    expect(a2_1.stunned).toBe(a2_2.stunned);
    expect(a2_1.state).toBe(a2_2.state);
  });
});
