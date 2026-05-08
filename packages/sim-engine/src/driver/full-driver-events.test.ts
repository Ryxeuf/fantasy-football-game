/**
 * Tests pour `full-driver-events.ts` (Lot 3.A.2.b).
 *
 * Vérifie que la diff prev → next produit les events MatchEvent
 * attendus pour chaque side-effect (TD, CASUALTY, KO, TURNOVER,
 * HALFTIME, END, TURN_START) ET les events Move-specific (BLOCK,
 * PASS, DODGE, FOUL).
 */

import { describe, expect, it } from 'vitest';

import { setup } from '@bb/game-engine';
import type { GameState, Move } from '@bb/game-engine';

import { diffStatesToEvents } from './full-driver-events';

function modify(state: GameState, patch: Partial<GameState>): GameState {
  return { ...state, ...patch };
}

describe('diffStatesToEvents — Lot 3.A.2.b', () => {
  it('émet un BLOCK event pour un Move BLOCK', () => {
    const prev = setup();
    const next = prev;
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    const block = events.find((e) => e.type === 'BLOCK');
    expect(block).toBeDefined();
    const meta = block?.meta as { attackerId: string; defenderId: string };
    expect(meta.attackerId).toBe('A1');
    expect(meta.defenderId).toBe('B1');
  });

  it('émet un PASS event pour un Move PASS', () => {
    const prev = setup();
    const next = prev;
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'PASS')).toBe(true);
  });

  it('émet un BLOCK event kind=foul pour un Move FOUL', () => {
    const prev = setup();
    const next = prev;
    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    const foul = events.find((e) => e.type === 'BLOCK');
    expect(foul).toBeDefined();
    expect((foul?.meta as { kind: string }).kind).toBe('foul');
  });

  it('émet un TD event quand le score teamA augmente', () => {
    const prev = setup();
    const next = modify(prev, {
      score: { teamA: prev.score.teamA + 1, teamB: prev.score.teamB },
    });
    const move: Move = { type: 'END_TURN' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    const td = events.find((e) => e.type === 'TD');
    expect(td).toBeDefined();
    expect((td?.meta as { team: string }).team).toBe('home');
  });

  it('émet un TD event quand le score teamB augmente', () => {
    const prev = setup();
    const next = modify(prev, {
      score: { teamA: prev.score.teamA, teamB: prev.score.teamB + 1 },
    });
    const move: Move = { type: 'END_TURN' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    const td = events.find((e) => e.type === 'TD');
    expect(td).toBeDefined();
    expect((td?.meta as { team: string }).team).toBe('away');
  });

  it('émet un CASUALTY quand un joueur passe à state="casualty"', () => {
    const prev = setup();
    const next = modify(prev, {
      players: prev.players.map((p, i) =>
        i === 0 ? { ...p, state: 'casualty' as const } : p
      ),
    });
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'CASUALTY')).toBe(true);
  });

  it('émet un KO quand un joueur passe à state="knocked_out"', () => {
    const prev = setup();
    const next = modify(prev, {
      players: prev.players.map((p, i) =>
        i === 0 ? { ...p, state: 'knocked_out' as const } : p
      ),
    });
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'KO')).toBe(true);
  });

  it('émet un TURNOVER quand isTurnover passe à true', () => {
    const prev = setup();
    const next = modify(prev, { isTurnover: true });
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'TURNOVER')).toBe(true);
  });

  it('émet un HALFTIME quand gamePhase passe à halftime', () => {
    const prev = setup();
    const next = modify(prev, { gamePhase: 'halftime' as const });
    const move: Move = { type: 'END_TURN' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'HALFTIME')).toBe(true);
  });

  it('émet un END quand gamePhase passe à ended', () => {
    const prev = setup();
    const next = modify(prev, { gamePhase: 'ended' as const });
    const move: Move = { type: 'END_TURN' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'END')).toBe(true);
  });

  it('émet un TURN_START quand turn ou half avance', () => {
    const prev = setup();
    const next = modify(prev, { turn: prev.turn + 1 });
    const move: Move = { type: 'END_TURN' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'TURN_START')).toBe(true);
  });

  it('aucun event si rien ne change (idempotent)', () => {
    const prev = setup();
    const next = prev;
    const move: Move = { type: 'END_PLAYER_TURN', playerId: 'A1' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events).toEqual([]);
  });

  it('cumule plusieurs events sur une même transition (TD + TURN_START)', () => {
    const prev = setup();
    const next = modify(prev, {
      score: { teamA: prev.score.teamA + 1, teamB: prev.score.teamB },
      turn: prev.turn + 1,
    });
    const move: Move = { type: 'END_TURN' };
    const events = diffStatesToEvents(prev, next, {
      displayAtMs: 1000,
      move,
    });
    expect(events.some((e) => e.type === 'TD')).toBe(true);
    expect(events.some((e) => e.type === 'TURN_START')).toBe(true);
  });
});
