/**
 * Edge cases BB3 S3 :
 *  - PA=0 force target=6 (joueur ne devrait pas reussir une passe).
 *  - Pitch Invasion exclut les joueurs en reserves (pos.x < 0).
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { performPassRoll } from './passing';
import { applyKickoffEvent, KICKOFF_EVENTS } from './kickoff-events';
import type { GameState, Player, RNG } from '../core/types';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'A', pos: { x: 0, y: 0 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
    ...over,
  };
}

describe('PA=0 force target=6 (BB3 S3)', () => {
  it("joueur avec pa=0 ne peut quasi jamais reussir une passe", () => {
    const passer = basePlayer({ pa: 0 });
    // diceRoll=4 (rng 0.5) : 4 < 6 → echec.
    const rng = makeRNG([0.5]);
    const result = performPassRoll(passer, rng, 0);
    expect(result.targetNumber).toBe(6);
    expect(result.success).toBe(false);
  });

  it("joueur avec pa=0 reussit seulement sur un 6", () => {
    const passer = basePlayer({ pa: 0 });
    // diceRoll=6 (rng 0.99) → success.
    const rng = makeRNG([0.99]);
    const result = performPassRoll(passer, rng, 0);
    expect(result.targetNumber).toBe(6);
    expect(result.success).toBe(true);
  });

  it("joueur avec pa=3 garde le seuil normal (3+ → roll 3 success)", () => {
    const passer = basePlayer({ pa: 3 });
    const rng = makeRNG([0.4]); // roll=3
    const result = performPassRoll(passer, rng, 0);
    expect(result.targetNumber).toBe(3);
    expect(result.success).toBe(true);
  });
});

describe('Pitch Invasion exclut reserves (BB3 S3)', () => {
  it("les joueurs en dugout (pos.x < 0) ne sont PAS stunned", () => {
    const base = setup();
    const onPitch = basePlayer({
      id: 'A1', team: 'A', pos: { x: 5, y: 5 }, name: 'OnPitch',
    });
    const reserve = basePlayer({
      id: 'A2', team: 'A', pos: { x: -1, y: -1 }, name: 'Reserve',
    });
    const state: GameState = {
      ...base, players: [onPitch, reserve], currentPlayer: 'A',
    };

    // RNG : D6=6 (rng 0.99) pour chaque joueur — A1 stunned, A2 doit etre ignore.
    const rng = makeRNG([0.99, 0.99]);
    const result = applyKickoffEvent(state, KICKOFF_EVENTS[12], rng, 'A');

    const a1 = result.players.find(p => p.id === 'A1')!;
    const a2 = result.players.find(p => p.id === 'A2')!;
    expect(a1.stunned).toBe(true);
    expect(a2.stunned).toBeFalsy();
  });
});
