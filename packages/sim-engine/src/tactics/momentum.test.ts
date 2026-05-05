import { describe, expect, it } from 'vitest';

import {
  applyDecay,
  confidenceBoostFor,
  createMomentumTracker,
  recordBlock,
  recordFailure,
  recordTouchdown,
  type MomentumState,
  type MomentumTracker,
  type PlayerMomentum,
} from './momentum';

describe('createMomentumTracker — sprint Pro League 0.B.4', () => {
  it('starts every player at "normal"', () => {
    const t = createMomentumTracker();
    const out = t.get('p1');
    expect(out.state).toBe<MomentumState>('normal');
    expect(out.touchdowns).toBe(0);
    expect(out.successfulBlocks).toBe(0);
    expect(out.failureStreak).toBe(0);
  });

  it('returns a snapshot copy (no leak of internal state)', () => {
    const t = createMomentumTracker();
    const a = t.get('p1');
    const b = t.get('p1');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('hot transition — sprint rule "2+ TD or 3+ blocks reussis"', () => {
  it('1 TD does not yet flip the state to hot', () => {
    const t = createMomentumTracker();
    recordTouchdown(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('normal');
  });

  it('2 TD on the same player flip the state to hot', () => {
    const t = createMomentumTracker();
    recordTouchdown(t, 'p1');
    recordTouchdown(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('hot');
  });

  it('2 successful blocks do not yet flip to hot', () => {
    const t = createMomentumTracker();
    recordBlock(t, 'p1', { success: true });
    recordBlock(t, 'p1', { success: true });
    expect(t.get('p1').state).toBe<MomentumState>('normal');
  });

  it('3 successful blocks flip to hot', () => {
    const t = createMomentumTracker();
    recordBlock(t, 'p1', { success: true });
    recordBlock(t, 'p1', { success: true });
    recordBlock(t, 'p1', { success: true });
    expect(t.get('p1').state).toBe<MomentumState>('hot');
  });

  it('failed blocks do not count toward the hot threshold', () => {
    const t = createMomentumTracker();
    recordBlock(t, 'p1', { success: true });
    recordBlock(t, 'p1', { success: false });
    recordBlock(t, 'p1', { success: true });
    expect(t.get('p1').successfulBlocks).toBe(2);
    expect(t.get('p1').state).toBe<MomentumState>('normal');
  });

  it('different players do not share counters', () => {
    const t = createMomentumTracker();
    recordTouchdown(t, 'p1');
    recordTouchdown(t, 'p2');
    expect(t.get('p1').state).toBe<MomentumState>('normal');
    expect(t.get('p2').state).toBe<MomentumState>('normal');
  });
});

describe('cold transition — sprint rule "echecs en chaine"', () => {
  it('1 failure stays normal', () => {
    const t = createMomentumTracker();
    recordFailure(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('normal');
  });

  it('3 failures in a row flip to cold', () => {
    const t = createMomentumTracker();
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('cold');
  });

  it('a success between two failures resets the streak', () => {
    const t = createMomentumTracker();
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    recordBlock(t, 'p1', { success: true });
    recordFailure(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('normal');
    expect(t.get('p1').failureStreak).toBe(1);
  });

  it('a TD between failures resets the streak', () => {
    const t = createMomentumTracker();
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    recordTouchdown(t, 'p1');
    recordFailure(t, 'p1');
    expect(t.get('p1').failureStreak).toBe(1);
  });

  it('a hot player who fails 3 times in a row drops to cold', () => {
    const t = createMomentumTracker();
    recordTouchdown(t, 'p1');
    recordTouchdown(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('hot');
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('cold');
  });
});

describe('confidenceBoostFor — used by 0.E tuning loop', () => {
  it('hot returns +1, normal 0, cold -1', () => {
    expect(confidenceBoostFor('hot')).toBe(1);
    expect(confidenceBoostFor('normal')).toBe(0);
    expect(confidenceBoostFor('cold')).toBe(-1);
  });
});

describe('applyDecay — cross-match decay (consumed by lot 0.C.4 PlayerForm)', () => {
  it('decays a hot player one notch toward normal', () => {
    const t = createMomentumTracker();
    recordTouchdown(t, 'p1');
    recordTouchdown(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('hot');
    applyDecay(t);
    expect(t.get('p1').state).toBe<MomentumState>('normal');
  });

  it('decays a cold player one notch toward normal', () => {
    const t = createMomentumTracker();
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    recordFailure(t, 'p1');
    expect(t.get('p1').state).toBe<MomentumState>('cold');
    applyDecay(t);
    expect(t.get('p1').state).toBe<MomentumState>('normal');
  });

  it('keeps a normal player normal after decay', () => {
    const t = createMomentumTracker();
    applyDecay(t);
    expect(t.get('p1').state).toBe<MomentumState>('normal');
  });
});

describe('snapshot — public read API for Gazette / odds', () => {
  it('snapshot returns one entry per tracked player', () => {
    const t: MomentumTracker = createMomentumTracker();
    recordTouchdown(t, 'p1');
    recordBlock(t, 'p2', { success: true });
    const snap: readonly PlayerMomentum[] = t.snapshot();
    expect(snap).toHaveLength(2);
    expect(snap.find((p) => p.playerId === 'p1')?.touchdowns).toBe(1);
    expect(snap.find((p) => p.playerId === 'p2')?.successfulBlocks).toBe(1);
  });
});
