/**
 * BUG fix audit round 3 — Mutations CRITICAL :
 *  - `ball-pickup.ts` mutait `state.players[idx].hasBall = true`.
 *  - `failure-helpers.ts` mutait `state.players[playerIndex] = ...`.
 *  - `reroll-choose-handler.ts:87` shallow clone propagait la mutation.
 *
 * Vecteur d'attaque : tout reroll de dodge/pickup/gfi en live corrompait
 * le state serveur (replays + WebSocket multi-client).
 *
 * Ces tests verifient l'invariant : passer un state en parametre ne le
 * mute JAMAIS. Snapshot JSON deep equality avant/apres.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove } from './actions';
import { handleBallPickup } from './ball-pickup';
import { applyRollFailure, applyPickupFailure } from './failure-helpers';
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

describe('ball-pickup — immutabilite', () => {
  it("handleBallPickup ne mute pas le state d'entree (pickup reussi)", () => {
    const base = setup();
    const player = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } });
    const state: GameState = {
      ...base,
      players: [player],
      ball: { x: 5, y: 5 },
      currentPlayer: 'A',
    };
    const snapshot = JSON.parse(JSON.stringify(state));
    const idx = 0;
    const rng = makeRNG([0.99, 0.99]);

    handleBallPickup(state, player, rng, idx);

    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });

  it("handleBallPickup ne mute pas state.players[idx].hasBall", () => {
    const base = setup();
    const player = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } });
    const state: GameState = {
      ...base,
      players: [player],
      ball: { x: 5, y: 5 },
      currentPlayer: 'A',
    };
    const rng = makeRNG([0.99, 0.99]);

    const result = handleBallPickup(state, player, rng, 0);

    // result.players[0].hasBall = true, mais state.players[0].hasBall reste falsy.
    expect(state.players[0].hasBall).toBeFalsy();
    expect(result.players[0].hasBall).toBe(true);
    // Reference distincte garantie.
    expect(state.players).not.toBe(result.players);
  });
});

describe('failure-helpers — immutabilite', () => {
  it("applyRollFailure ne mute pas state.players[i]", () => {
    const base = setup();
    const player = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, hasBall: false });
    const state: GameState = {
      ...base,
      players: [player],
      currentPlayer: 'A',
    };
    const snapshot = JSON.parse(JSON.stringify(state));
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5]);

    applyRollFailure(state, 0, rng, 0);

    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });

  it("applyPickupFailure ne mute pas state.isTurnover ni state.gameLog", () => {
    const base = setup();
    const player = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } });
    const state: GameState = {
      ...base,
      players: [player],
      ball: { x: 5, y: 5 },
      currentPlayer: 'A',
    };
    const snapshot = JSON.parse(JSON.stringify(state));
    const rng = makeRNG([0.5, 0.5]);

    applyPickupFailure(state, 0, rng);

    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });
});

describe('reroll-choose-handler — pas de cross-state corruption', () => {
  it("REROLL_CHOOSE refuse ne corrompt pas le state caller", () => {
    // Scenario : un pickup raté en attente de reroll. Le coach refuse
    // la relance via REROLL_CHOOSE. Avant le fix, applyPickupFailure
    // ecrivait dans state.players[idx] qui etait partage avec le caller.
    const base = setup();
    const player = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } });
    const state: GameState = {
      ...base,
      players: [player],
      ball: { x: 5, y: 5 },
      currentPlayer: 'A',
      pendingReroll: {
        rollType: 'pickup',
        playerId: 'A1',
        team: 'A',
        targetNumber: 4,
        modifiers: 0,
        playerIndex: 0,
      },
    };
    const snapshot = JSON.parse(JSON.stringify(state));
    const move: Move = { type: 'REROLL_CHOOSE', useReroll: false };
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5]);

    applyMove(state, move, rng);

    // Le state d'origine doit etre intact.
    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });
});
