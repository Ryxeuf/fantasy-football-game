/**
 * BUG fix audit round 3 HIGH : `move-leap-dodge-handlers.ts` et
 * `move-handlers.ts` mutaient les players in-place dans le clone
 * (`next.players[idx].pos = ...`, `next.players[idx].pm = ...`).
 *
 * Local au clone donc safe pour le caller direct, mais anti-pattern :
 * toute reassignation future de `next` casserait la chaine. Maintenant
 * via spread immutable + `players.map()`.
 *
 * Ces tests verifient que le state d'entree reste intact (snapshot
 * JSON deep equality avant/apres). Garde-fou contre regression.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove } from './actions';
import type { GameState, Player, RNG, Move } from '../core/types';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'A', pos: { x: 5, y: 5 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
    ...over,
  };
}

describe('MOVE handlers — immutabilite stricte', () => {
  it("MOVE simple ne mute pas state.players[i]", () => {
    const base = setup();
    const player = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } });
    const state: GameState = {
      ...base, players: [player], currentPlayer: 'A',
    };
    const snapshot = JSON.parse(JSON.stringify(state));
    const move: Move = { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 5 } };
    const rng = makeRNG([0.5, 0.5]);

    applyMove(state, move, rng);

    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });

  it("MOVE avec dodge ne mute pas state.players[i].pm/pos", () => {
    const base = setup();
    const a1 = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } });
    const opp = basePlayer({ id: 'B1', team: 'B', pos: { x: 5, y: 6 } });
    const state: GameState = {
      ...base, players: [a1, opp], currentPlayer: 'A',
    };
    const beforePm = state.players[0].pm;
    const beforePos = { ...state.players[0].pos };

    const move: Move = { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 5 } };
    const rng = makeRNG([0.99, 0.5, 0.5]);
    applyMove(state, move, rng);

    expect(state.players[0].pm).toBe(beforePm);
    expect(state.players[0].pos).toEqual(beforePos);
  });
});
