/**
 * BUG fix : `consumeOncePerMatchSkills` n'etait appele que sur
 * `'on-armor'` (`mechanics/blocking.ts:205`). Les skills star player
 * « once-per-match » sur d'autres triggers (Pirouette `on-dodge`,
 * Casse-Os `on-block-attacker`) firaient indefiniment.
 *
 * Verifie que les modifiers contributifs marquent le skill comme
 * utilise via `markStarPlayerRuleUsed`.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove } from '../actions/actions';
import { isStarPlayerRuleUsed } from './star-player-rules';
import type { GameState, Player, RNG, Move } from '../core/types';

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

describe("Star player rules once-per-match — consume sur block/dodge", () => {
  it("Casse-Os (on-block-attacker) marque le skill comme utilise apres un blocage", () => {
    const base = setup();
    const attacker = basePlayer({
      id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['casse-os'], st: 3,
    });
    const target = basePlayer({
      id: 'B1', team: 'B', pos: { x: 6, y: 5 }, st: 3,
    });
    const state: GameState = {
      ...base, players: [attacker, target], currentPlayer: 'A',
    };

    // Avant le bloc : Casse-Os pas encore utilise.
    expect(isStarPlayerRuleUsed(state, 'A1', 'casse-os')).toBe(false);

    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const result = applyMove(state, move, rng);

    // Apres le bloc : Casse-Os marque comme consume.
    expect(isStarPlayerRuleUsed(result, 'A1', 'casse-os')).toBe(true);
  });

  it("Pirouette (on-dodge) marque le skill comme utilise apres un dodge", () => {
    const base = setup();
    const dodger = basePlayer({
      id: 'A1', team: 'A', pos: { x: 5, y: 5 },
      skills: ['pirouette'], pm: 5,
    });
    // Un adversaire en TZ pour forcer un dodge.
    const opp = basePlayer({
      id: 'B1', team: 'B', pos: { x: 5, y: 6 },
    });
    const state: GameState = {
      ...base, players: [dodger, opp], currentPlayer: 'A',
    };

    expect(isStarPlayerRuleUsed(state, 'A1', 'pirouette')).toBe(false);

    // MOVE de (5,5) vers (6,5) — esquive necessaire car B1 est adjacent a (5,5).
    const move: Move = { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 5 } };
    const rng = makeRNG([0.99, 0.5, 0.5, 0.5]);
    const result = applyMove(state, move, rng);

    expect(isStarPlayerRuleUsed(result, 'A1', 'pirouette')).toBe(true);
  });
});

describe('Diving Tackle Prone post-dodge (BB3 S3)', () => {
  it("Le tackleur se place Prone (stunned) apres avoir contribue au -2", () => {
    const base = setup();
    const dodger = basePlayer({
      id: 'A1', team: 'A', pos: { x: 5, y: 5 }, pm: 5,
    });
    const tackler = basePlayer({
      id: 'B1', team: 'B', pos: { x: 5, y: 6 },
      skills: ['diving-tackle'],
    });
    const state: GameState = {
      ...base, players: [dodger, tackler], currentPlayer: 'A',
    };

    expect(tackler.stunned).toBeFalsy();

    const move: Move = { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 5 } };
    const rng = makeRNG([0.99, 0.5, 0.5, 0.5]);
    const result = applyMove(state, move, rng);

    const tacklerAfter = result.players.find(p => p.id === 'B1')!;
    expect(tacklerAfter.stunned).toBe(true);

    // Log doit mentionner Diving Tackle Prone.
    const dtLog = result.gameLog.find(l => l.message.includes('Diving Tackle'));
    expect(dtLog).toBeDefined();
  });
});
