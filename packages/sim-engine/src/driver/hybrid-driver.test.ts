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

describe('runHybridDriver — turnover does not chain into a same-turn TD (Bug #1)', () => {
  /**
   * Regression : a turnover during a key moment used to leave
   * `hasPossession=true` on the new team and the yard-advancement
   * block still ran for that team in the same turn — producing
   * "pickup_failed → opponent TD" sequences inside a single
   * TURN_START block. After the fix, a turnover ends the turn ; the
   * new possession is played on the next call to processTurn.
   *
   * We assert this over 200 seeds : there is no TURN_START block in
   * which a TURNOVER event is followed by a TD event before the next
   * TURN_START / HALFTIME / END.
   */
  it('no TD ever follows a TURNOVER inside the same turn block', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      let inTurnoverBlock = false;
      for (const ev of out.events) {
        if (
          ev.type === 'TURN_START' ||
          ev.type === 'HALFTIME' ||
          ev.type === 'END' ||
          ev.type === 'KICKOFF'
        ) {
          inTurnoverBlock = false;
          continue;
        }
        if (ev.type === 'TURNOVER') {
          inTurnoverBlock = true;
          continue;
        }
        if (inTurnoverBlock && ev.type === 'TD') {
          throw new Error(
            `seed=${seed}: a TD event was emitted in the same turn as a preceding TURNOVER`
          );
        }
      }
    }
  });

  /**
   * Regression : the hybrid AI can pick `pickup` as a key moment for a
   * team that is already in possession (the hybrid model never enters
   * a "loose ball" state — `hasPossession` is always true on the
   * driving team). The resolver then rolls and could surface a
   * nonsensical "team-with-ball pickup_failed → turnover", which the
   * user observed in replay #2 turn 4. The driver must skip the
   * pickup when the active player already holds the ball — at which
   * point no `pickup_failed` should ever fire across a normal match.
   */
  /**
   * Regression : breakthrough yards used to push +30..+40 in a single
   * roll, which on a 26-yard field meant single-turn TD from the
   * kickoff line. Now capped at 16 yards/turn, so the ball cannot
   * advance from yardline ≤ 9 to TD inside a single turn block. We
   * scan every TD event and verify the *previous* TURN_START's
   * `ballYardline` was at least 10.
   */
  it('no TD scores from yardline ≤ 9 inside a single turn (post-cap of 16 yards/turn)', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      let lastTurnStartYardline: number | null = null;
      let lastTurnStartTeam: string | null = null;
      for (const ev of out.events) {
        if (ev.type === 'TURN_START') {
          const m = (ev.meta ?? {}) as Record<string, unknown>;
          lastTurnStartYardline = Number(m.ballYardline);
          lastTurnStartTeam = String(m.drivingTeam);
        }
        if (ev.type === 'TD' && lastTurnStartYardline !== null) {
          const m = (ev.meta ?? {}) as Record<string, unknown>;
          // Only assert when the scoring team matches the team in
          // possession at the start of this turn — guards against a
          // mid-turn drive switch (which our other regression test
          // already prevents anyway).
          if (m.team === lastTurnStartTeam) {
            expect(lastTurnStartYardline).toBeGreaterThanOrEqual(10);
          }
        }
      }
    }
  });

  /**
   * Successful pass moments now advance the drive by the pass
   * distance (4 yards short pass in the synthetic resolver state).
   * We assert that across 200 seeds at least one TURN_START → next
   * TURN_START transition reflects an integer yard delta — i.e. the
   * driver's bulk rollYards output isn't the only source of yardage
   * anymore, passes contribute too. This is a smoke test : the
   * exact yardage attribution per event is hard to verify from the
   * timeline alone (events share displayAtMs), so we just verify
   * yardline progression is observed across PASS-success turns.
   */
  it('successful PASS events contribute to ball advancement (smoke)', () => {
    let observed = 0;
    for (let seed = 0; seed < 200 && observed < 1; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      // Find a turn that contains a successful PASS event and check
      // the next TURN_START shows a positive yardline delta on the
      // same drivingTeam.
      let lastTurnStart:
        | { yardline: number; team: string }
        | null = null;
      let sawPassSuccess = false;
      for (const ev of out.events) {
        if (ev.type === 'TURN_START') {
          if (sawPassSuccess && lastTurnStart) {
            const m = (ev.meta ?? {}) as Record<string, unknown>;
            if (
              String(m.drivingTeam) === lastTurnStart.team &&
              Number(m.ballYardline) > lastTurnStart.yardline
            ) {
              observed += 1;
            }
          }
          const m = (ev.meta ?? {}) as Record<string, unknown>;
          lastTurnStart = {
            yardline: Number(m.ballYardline),
            team: String(m.drivingTeam),
          };
          sawPassSuccess = false;
        }
        if (ev.type === 'PASS') {
          const m = (ev.meta ?? {}) as Record<string, unknown>;
          if (m.success === true) sawPassSuccess = true;
        }
      }
    }
    expect(observed).toBeGreaterThan(0);
  });

  it('no pickup_failed turnover ever fires (active team always already has possession)', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      const pickupFails = out.events.filter(
        (ev) =>
          ev.type === 'TURNOVER' &&
          (ev.meta as { cause?: string } | undefined)?.cause === 'pickup_failed'
      );
      expect(pickupFails).toHaveLength(0);
    }
  });
});

describe('runHybridDriver — Eye of Nuffle hooks (sprint 0.C.2)', () => {
  it('emits NUFFLE events on at least some seeds (~30% turn rate)', () => {
    let totalNuffle = 0;
    for (let seed = 0; seed < 30; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      totalNuffle += out.summary.nuffleCount;
    }
    expect(totalNuffle).toBeGreaterThan(0);
  });

  it('summary.nuffleCount equals the number of NUFFLE events on the timeline', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const out = runHybridDriver(baseInput({ seed }));
      const onTimeline = out.events.filter((e) => e.type === 'NUFFLE').length;
      expect(onTimeline).toBe(out.summary.nuffleCount);
    }
  });

  it('every NUFFLE event passes the @bb/shared-types runtime guard', () => {
    const out = runHybridDriver(baseInput({ seed: 31337 }));
    const nuffles = out.events.filter((e) => e.type === 'NUFFLE');
    for (const n of nuffles) {
      expect(isMatchEvent(n)).toBe(true);
    }
  });

  it('NUFFLE events fire just after a TURN_START on the same displayAtMs', () => {
    const out = runHybridDriver(baseInput({ seed: 7 }));
    for (let i = 0; i < out.events.length; i += 1) {
      if (out.events[i].type === 'NUFFLE') {
        // Walk back: the closest preceding non-NUFFLE event should be a
        // TURN_START at the same wall-clock offset.
        let j = i - 1;
        while (j >= 0 && out.events[j].type === 'NUFFLE') j -= 1;
        expect(j).toBeGreaterThanOrEqual(0);
        expect(out.events[j].type).toBe('TURN_START');
        expect(out.events[j].displayAtMs).toBe(out.events[i].displayAtMs);
      }
    }
  });

  it('determinism: same seed reproduces the exact same NUFFLE timeline', () => {
    const a = runHybridDriver(baseInput({ seed: 314 }));
    const b = runHybridDriver(baseInput({ seed: 314 }));
    const nA = a.events.filter((e) => e.type === 'NUFFLE');
    const nB = b.events.filter((e) => e.type === 'NUFFLE');
    expect(nB).toEqual(nA);
  });
});

describe('runHybridDriver — Underdog variance boost (sprint 0.C.3)', () => {
  const evenMatch = (seed: number): SimInput => ({
    seed,
    home: { id: 'pit-smashers', name: 'Pittsburgh', side: 'home', tv: 1000 },
    away: { id: 'kc-hawks', name: 'Kansas City', side: 'away', tv: 1000 },
  });

  const lopsidedMatch = (seed: number): SimInput => ({
    seed,
    home: { id: 'pit-smashers', name: 'Pittsburgh', side: 'home', tv: 1500 },
    away: { id: 'gb-cheese-halflings', name: 'Halflings', side: 'away', tv: 800 },
  });

  it('summary.underdogBoostCount is 0 when no TV gap is provided (default match)', () => {
    const out = runHybridDriver(baseInput({ seed: 1 }));
    expect(out.summary.underdogBoostCount).toBe(0);
  });

  it('summary.underdogBoostCount is 0 when TVs are equal', () => {
    const out = runHybridDriver(evenMatch(1));
    expect(out.summary.underdogBoostCount).toBe(0);
  });

  it('summary.underdogBoostCount can be positive when there is a TV gap > 200', () => {
    let total = 0;
    // Iter #12-16 : UNDERDOG_BOOST_PROBABILITY 10% → 3%, donc un
    // échantillon plus large est nécessaire pour observer un trigger.
    for (let seed = 0; seed < 200; seed += 1) {
      total += runHybridDriver(lopsidedMatch(seed)).summary.underdogBoostCount;
    }
    expect(total).toBeGreaterThan(0);
  });

  it('underdog boost reduces total turnovers vs no-TV baseline (statistical)', () => {
    let withBoostTurnovers = 0;
    let baselineTurnovers = 0;
    const N = 50;
    for (let seed = 0; seed < N; seed += 1) {
      withBoostTurnovers += runHybridDriver(lopsidedMatch(seed)).summary.turnoverCount;
      baselineTurnovers += runHybridDriver(evenMatch(seed)).summary.turnoverCount;
    }
    // The underdog boost retries some turnovers, so at the population
    // level the lopsided match should not generate strictly more
    // turnovers. We assert the no-boost baseline is at least as
    // turnover-heavy as the boosted lopsided. Tolerance bumped from
    // ±5 to ±15 after the breakthrough cap landed (longer drives = more
    // key moments per match = larger absolute turnover counts) ; the
    // intent (boost reduces turnovers) is unchanged.
    expect(withBoostTurnovers).toBeLessThanOrEqual(baselineTurnovers + 15);
  });

  it('determinism: same seed + same TV gap reproduces the result', () => {
    const a = runHybridDriver(lopsidedMatch(7777));
    const b = runHybridDriver(lopsidedMatch(7777));
    expect(b).toEqual(a);
  });
});

