/**
 * BB3 S3 lasting injury : un joueur ayant subi une lasting_injury
 * (casualty roll 13-14) voit sa stat correspondante reduite de 1
 * immediatement. Avant le fix, le `lastingInjuryDetails[playerId]`
 * etait stocke mais `player.ma/av/ag/pa/st` n'etait jamais decrement.
 * La casualty etait purement cosmetique.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { performInjuryRoll } from './injury';
import type { GameState, Player, RNG } from '../core/types';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'V', team: 'B', pos: { x: -1, y: -1 }, name: 'Victim', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
    ...over,
  };
}

function makeState(victim: Player): GameState {
  const s = setup();
  return { ...s, players: [...s.players, victim], currentPlayer: 'A' };
}

describe('Lasting injury stat reduction (BB3 S3)', () => {
  it("lasting_injury type '-1ma' reduit MA du joueur de 1", () => {
    const victim = basePlayer({ id: 'V', ma: 6 });
    const state = makeState(victim);
    // RNG : injury 2D6=12 (casualty), then casualtyRoll D16 = 13
    // (rng = 12/16 = 0.75 → floor(0.75*16)+1 = 13).
    // Then rollLastingInjuryType : rng=0 → roll=1 → '-1ma'.
    const rng = makeRNG([0.99, 0.99, 0.75, 0.0, 0.5, 0.5]);
    const result = performInjuryRoll(state, victim, rng, 0);

    const victimAfter = result.players.find(p => p.id === 'V')!;
    expect(victimAfter.ma).toBe(5); // 6 - 1
  });

  it("lasting_injury type '-1st' reduit ST du joueur de 1", () => {
    const victim = basePlayer({ id: 'V', st: 4 });
    const state = makeState(victim);
    // RNG : injury 12, casualty D16=13, rollLasting rng=0.99 → roll=6 → '-1st'.
    const rng = makeRNG([0.99, 0.99, 0.75, 0.99, 0.5, 0.5]);
    const result = performInjuryRoll(state, victim, rng, 0);

    const victimAfter = result.players.find(p => p.id === 'V')!;
    expect(victimAfter.st).toBe(3); // 4 - 1
  });

  it("stats sont clamp a 1 minimum (pas de 0)", () => {
    const victim = basePlayer({ id: 'V', ma: 1, st: 1, ag: 1, av: 1 });
    const state = makeState(victim);
    // Lasting injury -1ma → 1 - 1 = 0, clamp to 1.
    const rng = makeRNG([0.99, 0.99, 0.75, 0.0, 0.5, 0.5]);
    const result = performInjuryRoll(state, victim, rng, 0);

    const victimAfter = result.players.find(p => p.id === 'V')!;
    expect(victimAfter.ma).toBe(1); // clamped
  });
});
