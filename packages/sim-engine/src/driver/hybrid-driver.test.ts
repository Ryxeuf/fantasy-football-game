import { isMatchEvent } from '@bb/shared-types';
import { describe, expect, it } from 'vitest';

import type { SimInput } from '../types';

import { runHybridDriver } from './hybrid-driver';

const baseInput = (overrides: Partial<SimInput> = {}): SimInput => ({
  seed: 42,
  home: { id: 'pit-smashers', name: 'Pittsburgh Smashers', side: 'home' },
  away: { id: 'kc-hawks', name: 'Kansas City Soaring Hawks', side: 'away' },
  ...overrides,
});

describe('runHybridDriver — sprint Pro League 0.A.2', () => {
  it('returns the documented SimResult shape', () => {
    const out = runHybridDriver(baseInput());
    expect(out).toHaveProperty('result');
    expect(out).toHaveProperty('events');
    expect(out).toHaveProperty('summary');
    expect(out).toHaveProperty('casualties');
    expect(out).toHaveProperty('engineVer');
  });

  it('is fully deterministic for a given seed', () => {
    const a = runHybridDriver(baseInput({ seed: 9999 }));
    const b = runHybridDriver(baseInput({ seed: 9999 }));
    expect(b).toEqual(a);
  });

  it('produces different timelines for different seeds', () => {
    const a = runHybridDriver(baseInput({ seed: 1 }));
    const b = runHybridDriver(baseInput({ seed: 2 }));
    // The two results may rarely happen to converge on the same final score,
    // but the event timelines must differ.
    expect(b.events).not.toEqual(a.events);
  });

  it('emits KICKOFF, exactly one HALFTIME, exactly one END per match', () => {
    const out = runHybridDriver(baseInput({ seed: 7 }));
    const types = out.events.map((e) => e.type);
    expect(types[0]).toBe('KICKOFF');
    expect(types.filter((t) => t === 'HALFTIME')).toHaveLength(1);
    expect(types.filter((t) => t === 'END')).toHaveLength(1);
    expect(types[types.length - 1]).toBe('END');
  });

  it('emits 16 TURN_START events (8 per half) over a normal match', () => {
    const out = runHybridDriver(baseInput({ seed: 11 }));
    const turnStarts = out.events.filter((e) => e.type === 'TURN_START');
    expect(turnStarts).toHaveLength(16);
  });

  it('every emitted event passes the @bb/shared-types runtime guard', () => {
    const out = runHybridDriver(baseInput({ seed: 13 }));
    for (const ev of out.events) {
      expect(isMatchEvent(ev)).toBe(true);
    }
  });

  it('every event carries the engineVer of the result envelope', () => {
    const out = runHybridDriver(baseInput({ seed: 17 }));
    for (const ev of out.events) {
      expect(ev.engineVer).toBe(out.engineVer);
    }
  });

  it('event timeline is monotonically non-decreasing on displayAtMs', () => {
    const out = runHybridDriver(baseInput({ seed: 21 }));
    for (let i = 1; i < out.events.length; i += 1) {
      expect(out.events[i].displayAtMs).toBeGreaterThanOrEqual(out.events[i - 1].displayAtMs);
    }
  });

  it('result outcome is consistent with the score', () => {
    const out = runHybridDriver(baseInput({ seed: 31 }));
    const { score } = out.summary;
    if (score.home > score.away) expect(out.result).toBe('home');
    else if (score.away > score.home) expect(out.result).toBe('away');
    else expect(out.result).toBe('draw');
  });

  it('TD events match summary.touchdownCount', () => {
    const out = runHybridDriver(baseInput({ seed: 41 }));
    const tdEvents = out.events.filter((e) => e.type === 'TD');
    expect(tdEvents).toHaveLength(out.summary.touchdownCount);
  });

  it('TURNOVER events match summary.turnoverCount', () => {
    const out = runHybridDriver(baseInput({ seed: 53 }));
    const turnovers = out.events.filter((e) => e.type === 'TURNOVER');
    expect(turnovers).toHaveLength(out.summary.turnoverCount);
  });

  it('summary.durationMs is positive and matches the END event displayAtMs', () => {
    const out = runHybridDriver(baseInput({ seed: 67 }));
    const endEvent = out.events.find((e) => e.type === 'END');
    expect(endEvent).toBeDefined();
    expect(out.summary.durationMs).toBe(endEvent?.displayAtMs);
    expect(out.summary.durationMs).toBeGreaterThan(0);
  });

  it('honours kickoffAtMs option for broadcaster wall-clock alignment', () => {
    const out = runHybridDriver(baseInput({ seed: 71 }), { kickoffAtMs: 60_000 });
    const kickoff = out.events.find((e) => e.type === 'KICKOFF');
    expect(kickoff?.displayAtMs).toBe(60_000);
  });

  it('100 random seeds : every match completes without throwing and reaches END', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      expect(out.events[out.events.length - 1].type).toBe('END');
      expect(out.summary.score.home).toBeGreaterThanOrEqual(0);
      expect(out.summary.score.away).toBeGreaterThanOrEqual(0);
    }
  });

  it('home and away are not systematically biased over 100 seeds', () => {
    let homeWins = 0;
    let awayWins = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      if (out.result === 'home') homeWins += 1;
      else if (out.result === 'away') awayWins += 1;
    }
    // Mirror teams ; expect roughly equal — accept a wide window because
    // the synthesis hasn't been tuned (lot 0.E does that).
    expect(Math.abs(homeWins - awayWins)).toBeLessThan(40);
  });
});
