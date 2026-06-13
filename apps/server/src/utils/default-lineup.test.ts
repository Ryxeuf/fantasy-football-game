import { describe, it, expect } from 'vitest';
import {
  buildDefaultLineup,
  type DefaultLineupPosition,
} from './default-lineup';

function pos(
  slug: string,
  overrides: Partial<DefaultLineupPosition> = {},
): DefaultLineupPosition {
  return {
    slug,
    displayName: slug,
    cost: 50,
    min: 0,
    max: 16,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: '',
    ...overrides,
  };
}

describe('buildDefaultLineup', () => {
  it('returns an empty lineup when no positions are provided', () => {
    expect(buildDefaultLineup([])).toEqual([]);
  });

  it('fills up to 11 players using the cheapest high-cap position', () => {
    const positions = [
      pos('blitzer', { cost: 90, max: 4 }),
      pos('lineman', { cost: 50, max: 16 }),
    ];
    const lineup = buildDefaultLineup(positions);
    const total = lineup.reduce((acc, e) => acc + e.count, 0);
    expect(total).toBe(11);
    // Lineman has the largest cap -> it is the filler.
    const lineman = lineup.find((e) => e.position === 'lineman');
    expect(lineman?.count).toBe(11);
  });

  it('honours mandatory minimums before filling with the lineman', () => {
    const positions = [
      pos('big_guy', { cost: 110, min: 1, max: 1 }),
      pos('runner', { cost: 80, min: 2, max: 2 }),
      pos('lineman', { cost: 50, max: 16 }),
    ];
    const lineup = buildDefaultLineup(positions);
    const byPos = Object.fromEntries(lineup.map((e) => [e.position, e.count]));
    expect(byPos.big_guy).toBe(1);
    expect(byPos.runner).toBe(2);
    expect(byPos.lineman).toBe(8); // 1 + 2 + 8 = 11
  });

  it('tops up with other positions when the filler is capped', () => {
    const positions = [
      pos('lineman', { cost: 50, max: 6 }),
      pos('blitzer', { cost: 90, max: 8 }),
    ];
    const lineup = buildDefaultLineup(positions);
    const total = lineup.reduce((acc, e) => acc + e.count, 0);
    expect(total).toBe(11);
  });

  it('never exceeds the hard cap of 16 even with a high target', () => {
    const positions = [pos('lineman', { max: 16 })];
    const lineup = buildDefaultLineup(positions, { target: 30, hardCap: 16 });
    const total = lineup.reduce((acc, e) => acc + e.count, 0);
    expect(total).toBe(16);
  });

  it('carries stats and skills from the chosen positions', () => {
    const positions = [
      pos('runner', {
        cost: 80,
        min: 1,
        max: 2,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: 'dodge',
      }),
      pos('lineman', { cost: 50, max: 16, skills: '' }),
    ];
    const lineup = buildDefaultLineup(positions);
    const runner = lineup.find((e) => e.position === 'runner');
    expect(runner).toMatchObject({
      ma: 9,
      st: 2,
      ag: 2,
      pa: 4,
      av: 8,
      skills: 'dodge',
    });
  });

  it('keeps results deterministic for equal cap and cost (slug tiebreak)', () => {
    const positions = [
      pos('zebra', { cost: 50, max: 16 }),
      pos('alpha', { cost: 50, max: 16 }),
    ];
    const lineup = buildDefaultLineup(positions);
    const filler = lineup.find((e) => e.count === 11);
    expect(filler?.position).toBe('alpha');
  });
});
