/**
 * BB2020 rule : Stunty players suffer +1 modifier to any Casualty roll
 * made against them. Avant le fix, ce modifier était omis dans
 * `injury.ts:handleCasualty`. Test direct sur le code chemin.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { performInjuryRoll } from './injury';
import type { GameState, Player, RNG } from '../core/types';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

function makeStuntyVictim(): Player {
  return {
    id: 'V', team: 'B', pos: { x: -1, y: -1 }, name: 'Goblin', number: 1,
    position: 'Lineman', ma: 6, st: 2, ag: 3, pa: 4, av: 7,
    skills: ['stunty'], pm: 6, state: 'active',
  };
}

function makeRegularVictim(): Player {
  return {
    id: 'V', team: 'B', pos: { x: -1, y: -1 }, name: 'Lineman', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
  };
}

function makeState(victim: Player): GameState {
  const base = setup();
  return { ...base, players: [...base.players, victim], currentPlayer: 'A' };
}

describe('Stunty — +1 modifier au jet de Casualty (BB2020)', () => {
  it("le log de casualty mentionne `+1 Stunty` quand victim a stunty", () => {
    // injury roll : 2d6 = 6+6 = 12 (casualty), puis D16 casualty roll.
    // RNG : 0.99, 0.99 (injury), 0.5 (D16 base), 0.3 (rerolls et autres).
    const stunty = makeStuntyVictim();
    const state = makeState(stunty);
    const rng = makeTestRNG([0.99, 0.99, 0.5, 0.3, 0.5, 0.5, 0.5]);
    const result = performInjuryRoll(state, stunty, rng, 0);

    // Le log de casualty mentionne explicitement le +1 Stunty.
    const casualtyLog = result.gameLog.find(l =>
      l.message.includes('Jet de casualty')
    );
    expect(casualtyLog).toBeDefined();
    const details = casualtyLog?.details as Record<string, unknown> | undefined;
    expect(details?.stuntyMod).toBe(1);
  });

  it("aucun modificateur Stunty pour un joueur non-stunty", () => {
    const regular = makeRegularVictim();
    const state = makeState(regular);
    const rng = makeTestRNG([0.99, 0.99, 0.5, 0.3, 0.5, 0.5, 0.5]);
    const result = performInjuryRoll(state, regular, rng, 0);

    const casualtyLog = result.gameLog.find(l =>
      l.message.includes('Jet de casualty')
    );
    expect(casualtyLog).toBeDefined();
    const details = casualtyLog?.details as Record<string, unknown> | undefined;
    expect(details?.stuntyMod).toBe(0);
  });

  it("le casualty effectif est clampé à 16 (D16+1 → cap 16)", () => {
    // Avec D16 raw = 16 et stunty +1, le total deviendrait 17 → cap 16.
    const stunty = makeStuntyVictim();
    const state = makeState(stunty);
    // Force injury 2d6 = 12, puis D16 = 16 (rng 0.99 → floor(0.99*16)+1 = 16).
    const rng = makeTestRNG([0.99, 0.99, 0.99, 0.99, 0.99, 0.99]);
    const result = performInjuryRoll(state, stunty, rng, 0);

    const casualtyLog = result.gameLog.find(l =>
      l.message.includes('Jet de casualty')
    );
    const details = casualtyLog?.details as Record<string, unknown> | undefined;
    expect(details?.casualtyRoll).toBeLessThanOrEqual(16);
  });
});
