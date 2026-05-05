/**
 * Public entrypoint for the Pro League sim engine.
 *
 * Sprint Pro League — task 0.A.1 only delivers the workspace + the public
 * interface contract. The hybrid drive-level driver lands in 0.A.2 ; the
 * `MatchEvent` enum + `displayAtMs` channel in 0.A.3 ; the seeded PRNG in
 * 0.A.4 ; the action resolvers in 0.A.5.
 *
 * The current implementation is intentionally a deterministic placeholder
 * that satisfies the documented contract so consumers (broadcaster 1.B,
 * scheduler 1.A, bench 0.D) can wire against it today.
 */

import {
  ENGINE_VER,
  type Casualty,
  type MatchEvent,
  type MatchOutcome,
  type MatchSummary,
  type SimInput,
  type SimResult,
} from './types';

const KICKOFF_TIME_MS = 0;

function validate(input: SimInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('simulateMatch: input is required');
  }
  if (typeof input.seed !== 'number' || !Number.isFinite(input.seed)) {
    throw new Error('simulateMatch: input.seed must be a finite number');
  }
  if (!input.home || !input.away) {
    throw new Error('simulateMatch: input.home and input.away are required');
  }
  if (input.home.id === input.away.id) {
    throw new Error('simulateMatch: home and away teams must have distinct ids');
  }
  if (input.home.side !== 'home' || input.away.side !== 'away') {
    throw new Error('simulateMatch: team sides are inverted');
  }
}

function decideOutcome(home: number, away: number): MatchOutcome {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

export function simulateMatch(input: SimInput): SimResult {
  validate(input);

  const events: MatchEvent[] = [
    {
      type: 'KICKOFF',
      displayAtMs: KICKOFF_TIME_MS,
      seed: input.seed,
      payload: { home: input.home.id, away: input.away.id },
    },
  ];

  const score = { home: 0, away: 0 };
  const summary: MatchSummary = {
    outcome: decideOutcome(score.home, score.away),
    score,
    turnoverCount: 0,
    touchdownCount: 0,
    durationMs: 0,
  };

  const casualties: readonly Casualty[] = [];

  return {
    result: summary.outcome,
    events,
    summary,
    casualties,
    engineVer: ENGINE_VER,
  };
}
