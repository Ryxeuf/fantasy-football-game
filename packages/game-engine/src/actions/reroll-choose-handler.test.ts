/**
 * S27.8.14 — Smoke tests pour le handler `handleRerollChoose` extrait
 * dans `actions/reroll-choose-handler.ts`. Les regles metier completes
 * (Loner test, dodge/GFI/pickup reroll, applyRollFailure /
 * applyPickupFailure) sont couvertes par les tests existants
 * (`actions.test.ts`, dodge/pickup integration tests).
 *
 * Ici on s'assure que :
 *  1. l'API `handleRerollChoose` est exportee comme une fonction,
 *  2. le re-export depuis `choice-handlers.ts` reste valide,
 *  3. le gate `pendingReroll absent` retourne le state inchange.
 */

import { describe, it, expect } from 'vitest';
import type { GameState, RNG } from '../core/types';
import { handleRerollChoose } from './reroll-choose-handler';
import { handleRerollChoose as handleRerollChooseReExport } from './choice-handlers';

const rng: RNG = () => 0.5;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: 1, teamB: 1 },
    dugouts: {
      teamA: { reserves: [], ko: [], casualties: [] },
      teamB: { reserves: [], ko: [], casualties: [] },
    },
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'A', teamB: 'B' },
    teamRosters: { teamA: 'skaven', teamB: 'human' },
    pm: 0,
    gameLog: [],
    playerActions: {},
    teamBlitzCount: { A: 0, B: 0 },
    teamFoulCount: { A: 0, B: 0 },
    teamRerolls: { teamA: 3, teamB: 3 },
    matchStats: {},
    ...overrides,
  } as unknown as GameState;
}

describe('S27.8.14 — handleRerollChoose', () => {
  it('exporte une fonction depuis le nouveau module', () => {
    expect(typeof handleRerollChoose).toBe('function');
  });

  it('reste re-exporte depuis choice-handlers (backward compat)', () => {
    expect(typeof handleRerollChooseReExport).toBe('function');
    expect(handleRerollChooseReExport).toBe(handleRerollChoose);
  });

  it('retourne le state inchange si pendingReroll est absent', () => {
    const state = makeState({ pendingReroll: undefined });
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      rng,
    );
    expect(next).toBe(state);
  });

  it('retourne le state inchange si pendingReroll est absent (useReroll=false)', () => {
    const state = makeState({ pendingReroll: undefined });
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: false },
      rng,
    );
    expect(next).toBe(state);
  });

  it('ne mute pas le state passe en argument quand court-circuite par le gate', () => {
    const state = makeState({ pendingReroll: undefined });
    const snapshot = JSON.stringify(state);
    handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      rng,
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('audit round 4 — GFI reroll respecte le seuil meteo Blizzard', () => {
  function makeGfiRerollState(weather?: unknown): GameState {
    return makeState({
      players: [
        {
          id: 'A1',
          team: 'A',
          name: 'Alice',
          pos: { x: 5, y: 5 },
          stunned: false,
          ma: 6,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          pm: 6,
          gfiUsed: 1,
          hasBall: false,
          dead: false,
          ko: false,
          casualty: false,
          starPlayer: false,
          skills: [],
        } as any,
      ],
      pendingReroll: {
        rollType: 'gfi',
        playerId: 'A1',
        team: 'A',
        playerIndex: 0,
        from: { x: 5, y: 5 },
        to: { x: 5, y: 5 },
        modifiers: 0,
      } as any,
      teamRerolls: { teamA: 3, teamB: 3 } as any,
      rerollUsedThisTurn: false,
      weatherCondition: weather as any,
    });
  }

  it('utilise un seuil 3+ pour la relance GFI en Blizzard (vs 2+ normal)', () => {
    // RNG produit roll=1 → fail. Mais avant fix, seuil=2 (hardcode) →
    // serait fail aussi. On veut donc un cas qui passe a 2 et echoue a 3
    // pour discriminer : roll = 2.
    // Math.floor(rng() * 6) + 1 = 2 quand rng() = 0.166...
    const rng2: RNG = () => 0.2; // floor(1.2)+1 = 2
    const state = makeGfiRerollState({ condition: 'Blizzard' });
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      rng2,
    );
    // Avant fix : seuil=2, roll=2 → success, pas de failure log.
    // Apres fix : seuil=3 (Blizzard), roll=2 → fail.
    // On verifie via le gameLog que le seuil affiche est 3.
    const gfiRerollLog = next.gameLog.find((e) =>
      e.message?.startsWith('Relance GFI'),
    );
    expect(gfiRerollLog).toBeDefined();
    expect(gfiRerollLog?.message).toContain('/3');
    expect(gfiRerollLog?.details?.targetNumber).toBe(3);
    expect(gfiRerollLog?.details?.success).toBe(false);
  });

  it('utilise un seuil 2+ pour la relance GFI en temps normal', () => {
    const rng2: RNG = () => 0.2; // roll = 2
    const state = makeGfiRerollState(undefined);
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      rng2,
    );
    const gfiRerollLog = next.gameLog.find((e) =>
      e.message?.startsWith('Relance GFI'),
    );
    expect(gfiRerollLog).toBeDefined();
    expect(gfiRerollLog?.message).toContain('/2');
    expect(gfiRerollLog?.details?.targetNumber).toBe(2);
    expect(gfiRerollLog?.details?.success).toBe(true);
  });
});
