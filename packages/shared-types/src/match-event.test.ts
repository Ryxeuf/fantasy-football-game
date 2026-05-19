import { describe, expect, it } from 'vitest';

import {
  EVENT_TYPES,
  EventType,
  isMatchEvent,
  isOfEventType,
  type MatchEvent,
} from './match-event';

describe('EventType — sprint Pro League 0.A.3 catalogue', () => {
  it('exposes every event kind documented in the sprint table', () => {
    const expected = new Set<EventType>([
      'KICKOFF',
      'TURN_START',
      'PLAYER_ACTIVATION',
      'BLITZ_DECLARED',
      'BLOCK',
      'KNOCKDOWN',
      'DODGE',
      'PASS',
      'MOVE',
      'TD',
      'KO',
      'CASUALTY',
      'TURNOVER',
      'NUFFLE',
      'HALFTIME',
      'END',
      'DICE',
    ]);
    const declared = new Set<EventType>(EVENT_TYPES);
    expect(declared).toEqual(expected);
  });

  it('EVENT_TYPES is frozen so consumers cannot mutate the catalogue at runtime', () => {
    expect(Object.isFrozen(EVENT_TYPES)).toBe(true);
  });
});

describe('isMatchEvent — runtime guard at process boundaries', () => {
  const baseEvent: MatchEvent = {
    type: 'KICKOFF',
    displayAtMs: 0,
    engineVer: '0.1.0',
  };

  it('accepts a minimal valid event', () => {
    expect(isMatchEvent(baseEvent)).toBe(true);
  });

  it('accepts an event with optional seed and meta payload', () => {
    const event: MatchEvent = {
      type: 'BLOCK',
      displayAtMs: 4200,
      engineVer: '0.1.0',
      seed: 42,
      meta: { attackerId: 'p-1', defenderId: 'p-2', dice: [1, 2] },
    };
    expect(isMatchEvent(event)).toBe(true);
  });

  it('rejects events with an unknown type', () => {
    const bad = { ...baseEvent, type: 'NOT_A_REAL_EVENT' };
    expect(isMatchEvent(bad)).toBe(false);
  });

  it('rejects events without engineVer (replay freeze requirement)', () => {
    const bad = { type: 'KICKOFF', displayAtMs: 0 };
    expect(isMatchEvent(bad)).toBe(false);
  });

  it('rejects events with negative displayAtMs', () => {
    const bad = { ...baseEvent, displayAtMs: -1 };
    expect(isMatchEvent(bad)).toBe(false);
  });

  it('rejects events with non-integer displayAtMs', () => {
    const bad = { ...baseEvent, displayAtMs: 1.5 };
    expect(isMatchEvent(bad)).toBe(false);
  });

  it('rejects null, primitives and arrays', () => {
    expect(isMatchEvent(null)).toBe(false);
    expect(isMatchEvent(undefined)).toBe(false);
    expect(isMatchEvent('KICKOFF')).toBe(false);
    expect(isMatchEvent(42)).toBe(false);
    expect(isMatchEvent([])).toBe(false);
  });

  it('rejects events with non-numeric seed when present', () => {
    const bad = { ...baseEvent, seed: 'not-a-number' };
    expect(isMatchEvent(bad)).toBe(false);
  });
});

describe('isOfEventType — narrow event guards', () => {
  it('narrows by exact event type', () => {
    const ev: MatchEvent = {
      type: 'TD',
      displayAtMs: 60_000,
      engineVer: '0.1.0',
      meta: { team: 'A' },
    };
    expect(isOfEventType(ev, 'TD')).toBe(true);
    expect(isOfEventType(ev, 'BLOCK')).toBe(false);
  });

  it('isOfEventType returns false for invalid event objects', () => {
    expect(isOfEventType({ type: 'TD' }, 'TD')).toBe(false);
  });
});

describe('MatchEvent — sort/order semantics for live broadcaster (lot 1.B)', () => {
  it('events with the same displayAtMs preserve insertion order when sorted stably', () => {
    const evts: MatchEvent[] = [
      { type: 'TURN_START', displayAtMs: 1000, engineVer: '0.1.0', meta: { idx: 1 } },
      { type: 'BLOCK', displayAtMs: 1000, engineVer: '0.1.0', meta: { idx: 2 } },
      { type: 'CASUALTY', displayAtMs: 1000, engineVer: '0.1.0', meta: { idx: 3 } },
    ];
    const sorted = [...evts].sort((a, b) => a.displayAtMs - b.displayAtMs);
    expect(sorted.map((e) => (e.meta as { idx: number }).idx)).toEqual([1, 2, 3]);
  });
});
