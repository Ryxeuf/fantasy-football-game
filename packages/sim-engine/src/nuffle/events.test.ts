import { isMatchEvent } from '@bb/shared-types';
import { describe, expect, it } from 'vitest';

import { createRng } from '../rng/seeded';

import {
  NUFFLE_EVENTS,
  NUFFLE_EVENT_BY_ID,
  emitNuffleEvent,
  rollNuffleEvent,
  type NuffleEvent,
  type NuffleEventKind,
} from './events';

const ENGINE_VER = '0.1.0';

describe('NUFFLE_EVENTS — sprint Pro League 0.C.1 catalogue', () => {
  it('declares between 25 and 30 events (sprint range)', () => {
    expect(NUFFLE_EVENTS.length).toBeGreaterThanOrEqual(25);
    expect(NUFFLE_EVENTS.length).toBeLessThanOrEqual(30);
  });

  it('every event has a unique id', () => {
    const ids = NUFFLE_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every probability sits in (0, 1)', () => {
    for (const e of NUFFLE_EVENTS) {
      expect(e.probability).toBeGreaterThan(0);
      expect(e.probability).toBeLessThan(1);
    }
  });

  it('total probability stays in [0.20, 0.40] (per-turn Nuffle rate)', () => {
    const total = NUFFLE_EVENTS.reduce((acc, e) => acc + e.probability, 0);
    expect(total).toBeGreaterThanOrEqual(0.2);
    expect(total).toBeLessThanOrEqual(0.4);
  });

  it('every event has a non-empty description for the ticker', () => {
    for (const e of NUFFLE_EVENTS) {
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  it('every event declares a kind from the documented set', () => {
    const kinds: ReadonlySet<NuffleEventKind> = new Set([
      'positive',
      'negative',
      'neutral',
      'weather',
      'crowd',
    ]);
    for (const e of NUFFLE_EVENTS) {
      expect(kinds.has(e.kind)).toBe(true);
    }
  });

  it('includes the named events listed in the sprint table', () => {
    for (const required of [
      'rookie_brilliance',
      'crowd_riot',
      'sudden_inspiration',
      'weather_shift',
      'tantrum_star',
      'banana_skin',
      'bombardier_gone_wild',
      'nemesis_clash',
    ] as const) {
      expect(NUFFLE_EVENT_BY_ID[required]).toBeDefined();
    }
  });

  it('NUFFLE_EVENTS is frozen so consumers cannot mutate the catalogue', () => {
    expect(Object.isFrozen(NUFFLE_EVENTS)).toBe(true);
  });
});

describe('rollNuffleEvent — random sampling', () => {
  it('returns null on most turns (sub-50% trigger rate)', () => {
    const rng = createRng(42);
    let triggers = 0;
    const N = 1000;
    for (let i = 0; i < N; i += 1) {
      if (rollNuffleEvent(rng) !== null) triggers += 1;
    }
    expect(triggers).toBeLessThan(N * 0.5);
    expect(triggers).toBeGreaterThan(N * 0.1);
  });

  it('is deterministic per seed', () => {
    const collect = (seed: number): (string | null)[] => {
      const rng = createRng(seed);
      const out: (string | null)[] = [];
      for (let i = 0; i < 100; i += 1) {
        const ev = rollNuffleEvent(rng);
        out.push(ev?.id ?? null);
      }
      return out;
    };
    expect(collect(7)).toEqual(collect(7));
  });

  it('every triggered event is one of the catalogue entries', () => {
    const rng = createRng(11);
    for (let i = 0; i < 500; i += 1) {
      const ev = rollNuffleEvent(rng);
      if (ev) expect(NUFFLE_EVENT_BY_ID[ev.id]).toBe(ev);
    }
  });

  it('higher-probability events trigger more often than lower-probability ones', () => {
    const rng = createRng(99);
    const counts = new Map<string, number>();
    const N = 50_000;
    for (let i = 0; i < N; i += 1) {
      const ev = rollNuffleEvent(rng);
      if (ev) counts.set(ev.id, (counts.get(ev.id) ?? 0) + 1);
    }
    const high = NUFFLE_EVENT_BY_ID['weather_shift'];
    const low = NUFFLE_EVENT_BY_ID['crowd_riot'];
    expect(counts.get(high.id) ?? 0).toBeGreaterThan(counts.get(low.id) ?? 0);
  });
});

describe('emitNuffleEvent — wire format for the broadcaster', () => {
  it('produces a MatchEvent with type "NUFFLE" carrying the event id in meta', () => {
    const ev = NUFFLE_EVENT_BY_ID['rookie_brilliance'];
    const matchEvent = emitNuffleEvent(ev, {
      displayAtMs: 4200,
      engineVer: ENGINE_VER,
      seed: 1,
    });
    expect(matchEvent.type).toBe('NUFFLE');
    expect(matchEvent.engineVer).toBe(ENGINE_VER);
    expect(matchEvent.displayAtMs).toBe(4200);
    expect((matchEvent.meta as { id: string }).id).toBe('rookie_brilliance');
    expect(isMatchEvent(matchEvent)).toBe(true);
  });

  it('preserves description / kind / effect in meta for the ticker UI', () => {
    const ev: NuffleEvent = NUFFLE_EVENT_BY_ID['weather_shift'];
    const matchEvent = emitNuffleEvent(ev, { displayAtMs: 0, engineVer: ENGINE_VER });
    const meta = matchEvent.meta as { kind: string; description: string };
    expect(meta.kind).toBe(ev.kind);
    expect(meta.description).toBe(ev.description);
  });
});
