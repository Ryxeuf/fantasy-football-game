import { describe, expect, it } from 'vitest';

import { PRO_LEAGUE_TEAMS, PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';

import {
  formatBenchReport,
  runBench,
  runBenchMatrix,
  type BenchPairing,
} from './runner';

const teamA = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'];
const teamB = PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'];

describe('runBench — sprint Pro League 0.D.1', () => {
  it('runs the requested number of matches and aggregates metrics', () => {
    const out = runBench({
      pairing: { home: teamA, away: teamB },
      runs: 12,
      seedOffset: 0,
    });
    expect(out.matches).toBe(12);
    expect(out.metrics.matches).toBe(12);
    expect(out.pairing.home.id).toBe(teamA.id);
  });

  it('is deterministic for a given seedOffset (replay)', () => {
    const a = runBench({ pairing: { home: teamA, away: teamB }, runs: 8, seedOffset: 1000 });
    const b = runBench({ pairing: { home: teamA, away: teamB }, runs: 8, seedOffset: 1000 });
    expect(b).toEqual(a);
  });

  it('different seed offsets produce different metrics distributions', () => {
    const a = runBench({ pairing: { home: teamA, away: teamB }, runs: 10, seedOffset: 1 });
    const b = runBench({ pairing: { home: teamA, away: teamB }, runs: 10, seedOffset: 200 });
    // Same totals are extremely unlikely : at least one of std / mean / outcome counts differs.
    const same =
      a.metrics.td.mean === b.metrics.td.mean &&
      a.metrics.outcomes.home === b.metrics.outcomes.home;
    expect(same).toBe(false);
  });

  it('throws on runs <= 0', () => {
    expect(() =>
      runBench({ pairing: { home: teamA, away: teamB }, runs: 0, seedOffset: 0 })
    ).toThrow();
    expect(() =>
      runBench({ pairing: { home: teamA, away: teamB }, runs: -1, seedOffset: 0 })
    ).toThrow();
  });

  it('throws on non-integer runs', () => {
    expect(() =>
      runBench({ pairing: { home: teamA, away: teamB }, runs: 5.5, seedOffset: 0 })
    ).toThrow();
  });

  it('counts home/away/draw outcomes that sum to total matches', () => {
    const out = runBench({ pairing: { home: teamA, away: teamB }, runs: 50, seedOffset: 7 });
    const { home, away, draw } = out.metrics.outcomes;
    expect(home + away + draw).toBe(50);
  });

  it('annotates favorite from TV when both teams provide tv', () => {
    const out = runBench({
      pairing: {
        home: { ...teamA, tv: 1500 },
        away: { ...teamB, tv: 1000 },
      },
      runs: 20,
      seedOffset: 0,
    });
    // upsetRate must be derivable since favorite = 'home'
    expect(out.favorite).toBe('home');
  });

  it('omits favorite when TVs are missing', () => {
    // Strip the bundled tv to simulate ad-hoc pairings without TV input.
    const stripTv = <T extends { tv?: number }>(t: T): Omit<T, 'tv'> & { tv?: number } => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tv, ...rest } = t;
      return rest;
    };
    const out = runBench({
      pairing: {
        home: stripTv(teamA) as typeof teamA,
        away: stripTv(teamB) as typeof teamB,
      },
      runs: 20,
      seedOffset: 0,
    });
    expect(out.favorite).toBeUndefined();
  });
});

describe('runBenchMatrix — all-vs-all', () => {
  it('runs N(N-1)/2 unique pairings for N teams (no self-match, no duplicates)', () => {
    const teams = PRO_LEAGUE_TEAMS.slice(0, 3);
    const out = runBenchMatrix({ teams, runs: 4, seedOffset: 0 });
    // 3 teams -> 3 pairings (Orc-Dark, Orc-Wood, Dark-Wood)
    expect(out.pairings).toHaveLength(3);
    for (const p of out.pairings) {
      expect(p.metrics.matches).toBe(4);
    }
  });

  it('is deterministic for a given matrix invocation', () => {
    const teams = PRO_LEAGUE_TEAMS.slice(0, 3);
    const a = runBenchMatrix({ teams, runs: 4, seedOffset: 0 });
    const b = runBenchMatrix({ teams, runs: 4, seedOffset: 0 });
    expect(b).toEqual(a);
  });

  it('throws when fewer than 2 teams are provided', () => {
    expect(() =>
      runBenchMatrix({ teams: PRO_LEAGUE_TEAMS.slice(0, 1), runs: 4, seedOffset: 0 })
    ).toThrow();
  });
});

describe('formatBenchReport — text output', () => {
  it('renders a non-empty report with key headline numbers', () => {
    const out = runBench({ pairing: { home: teamA, away: teamB }, runs: 10, seedOffset: 0 });
    const report = formatBenchReport([out]);
    expect(report).toContain(teamA.name);
    expect(report).toContain(teamB.name);
    expect(report).toContain('TD/match');
    expect(report).toContain('std');
    expect(report).toContain('upset rate');
  });

  it('renders multi-pairing summaries one section per pairing', () => {
    const teams = PRO_LEAGUE_TEAMS.slice(0, 3);
    const matrix = runBenchMatrix({ teams, runs: 4, seedOffset: 0 });
    const report = formatBenchReport(matrix.pairings);
    // 3 pairings → at least 3 home/away headers.
    const matches = report.match(/===/g);
    expect((matches ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('flags FUMBBL-divergent home race with an annotation', () => {
    // Construct an artificial bench result with extreme winrate so the
    // formatter flags the divergence.
    const fakePairing: BenchPairing = {
      pairing: { home: teamA, away: teamB },
      matches: 100,
      metrics: {
        matches: 100,
        td: { mean: 1, std: 0.5, p5: 0, p95: 2 },
        casualties: { mean: 0.5, std: 0.5 },
        turnovers: { mean: 5 },
        fatTails: { highScoring: 0, bloodbath: 0 },
        outcomes: { home: 100, away: 0, draw: 0, upsetRate: 0 },
        meetsTargets: { stdDevTd: false, upsetRate: false },
      },
    };
    const report = formatBenchReport([fakePairing]);
    expect(report).toContain('OUTSIDE');
  });
});
