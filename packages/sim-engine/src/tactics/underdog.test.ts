import { describe, expect, it } from 'vitest';

import type { SimTeamInput } from '../types';

import {
  UNDERDOG_BOOST_PROBABILITY,
  UNDERDOG_TV_GAP_THRESHOLD,
  computeUnderdog,
} from './underdog';

const team = (id: string, side: 'home' | 'away', tv?: number): SimTeamInput => ({
  id,
  name: id,
  side,
  ...(tv !== undefined ? { tv } : {}),
});

describe('computeUnderdog — sprint Pro League 0.C.3', () => {
  it('returns no boost when both TVs are missing', () => {
    const out = computeUnderdog(team('a', 'home'), team('b', 'away'));
    expect(out.side).toBeNull();
    expect(out.probability).toBe(0);
  });

  it('returns no boost when only one TV is provided', () => {
    expect(computeUnderdog(team('a', 'home', 1000), team('b', 'away')).side).toBeNull();
    expect(computeUnderdog(team('a', 'home'), team('b', 'away', 1000)).side).toBeNull();
  });

  it('returns no boost when TV gap is below the threshold', () => {
    const out = computeUnderdog(team('a', 'home', 1000), team('b', 'away', 1199));
    expect(out.side).toBeNull();
    expect(out.tvGap).toBe(199);
  });

  it('flags the lower-TV side as underdog when gap >= threshold', () => {
    const out = computeUnderdog(team('a', 'home', 800), team('b', 'away', 1200));
    expect(out.side).toBe('home');
    expect(out.tvGap).toBe(400);
    expect(out.probability).toBe(UNDERDOG_BOOST_PROBABILITY);
  });

  it('flags away as underdog when home TV is higher', () => {
    const out = computeUnderdog(team('a', 'home', 1500), team('b', 'away', 1000));
    expect(out.side).toBe('away');
  });

  it('uses exactly the documented threshold (200)', () => {
    expect(UNDERDOG_TV_GAP_THRESHOLD).toBe(200);
    // Iter #12-16 (engineVer 0.13.0) : 0.10 → 0.03 pour ramener
    // l'upset rate des matchups TV-déséquilibrés dans la cible 12-18%.
    expect(UNDERDOG_BOOST_PROBABILITY).toBe(0.03);
    // Boundary : exactly 200 → boost active.
    const out = computeUnderdog(team('a', 'home', 1000), team('b', 'away', 1200));
    expect(out.side).toBe('home');
  });
});
