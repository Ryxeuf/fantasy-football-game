/**
 * Bench runner — sprint Pro League 0.D.1.
 *
 * Pure functions extracted from the CLI (`scripts/bench.ts`) for
 * testability. Two entry points :
 *
 * - `runBench(input)` : a single home/away pairing simulé `runs` times
 *   avec des seeds dérivés de `seedOffset`. Retourne les métriques
 *   `VivacityMetrics` (lot 0.D.3) sur l'échantillon.
 *
 * - `runBenchMatrix(input)` : N(N-1)/2 pairings sur les `teams`
 *   fournies, chacune avec `runs` matchs. Pas de self-match, pas de
 *   duplicates.
 *
 * Note : la version actuelle est synchrone single-threaded. Le sprint
 * mentionne `worker_threads` ; un follow-up pourra paralléliser via un
 * pool quand `runs * pairings` excède un seuil de coût. Le contrat
 * publié ici (`runBench` / `runBenchMatrix`) ne change pas ; seule
 * l'implémentation interne est susceptible de le faire.
 */

import { simulateMatch } from '../simulate-match';
import type { ProTeamProfile } from '../tactics/race-profiles';
import type { SimInput, SimTeamInput } from '../types';

import {
  computeVivacityMetrics,
  simResultToSample,
  type VivacityMetrics,
  type VivacitySample,
} from './metrics';
import { getFumbblRaceStats, isWithinFumbblTolerance } from './fumbbl-reference';

export interface BenchPair {
  home: ProTeamProfile & { tv?: number };
  away: ProTeamProfile & { tv?: number };
}

export interface BenchInput {
  pairing: BenchPair;
  runs: number;
  /** Seed of the first match. Subsequent matches get `seedOffset + i`. */
  seedOffset: number;
}

export interface BenchPairing {
  pairing: BenchPair;
  matches: number;
  metrics: VivacityMetrics;
  /** Pre-match favorite when both teams provided a TV. */
  favorite?: 'home' | 'away';
}

export interface BenchMatrixInput {
  teams: readonly ProTeamProfile[];
  runs: number;
  seedOffset: number;
}

export interface BenchMatrixResult {
  pairings: readonly BenchPairing[];
}

function toSimTeamInput(
  team: ProTeamProfile & { tv?: number },
  side: 'home' | 'away'
): SimTeamInput {
  return {
    id: team.id,
    name: team.name,
    side,
    tactics: team.tactics,
    tv: team.tv,
  };
}

function deriveFavorite(pair: BenchPair): 'home' | 'away' | undefined {
  if (typeof pair.home.tv !== 'number' || typeof pair.away.tv !== 'number') {
    return undefined;
  }
  if (pair.home.tv === pair.away.tv) return undefined;
  return pair.home.tv > pair.away.tv ? 'home' : 'away';
}

export function runBench(input: BenchInput): BenchPairing {
  if (!Number.isInteger(input.runs) || input.runs <= 0) {
    throw new Error('runBench: runs must be a positive integer');
  }
  const favorite = deriveFavorite(input.pairing);
  const samples: VivacitySample[] = [];
  for (let i = 0; i < input.runs; i += 1) {
    const seed = input.seedOffset + i;
    const sim: SimInput = {
      seed,
      home: toSimTeamInput(input.pairing.home, 'home'),
      away: toSimTeamInput(input.pairing.away, 'away'),
    };
    const result = simulateMatch(sim);
    samples.push(simResultToSample(result, favorite));
  }
  return {
    pairing: input.pairing,
    matches: input.runs,
    metrics: computeVivacityMetrics(samples),
    favorite,
  };
}

export function runBenchMatrix(input: BenchMatrixInput): BenchMatrixResult {
  if (input.teams.length < 2) {
    throw new Error('runBenchMatrix: at least 2 teams are required');
  }
  if (!Number.isInteger(input.runs) || input.runs <= 0) {
    throw new Error('runBenchMatrix: runs must be a positive integer');
  }

  const pairings: BenchPairing[] = [];
  let cursor = input.seedOffset;
  for (let i = 0; i < input.teams.length; i += 1) {
    for (let j = i + 1; j < input.teams.length; j += 1) {
      const out = runBench({
        pairing: { home: input.teams[i], away: input.teams[j] },
        runs: input.runs,
        seedOffset: cursor,
      });
      cursor += input.runs;
      pairings.push(out);
    }
  }
  return { pairings };
}

/* ------------------------------------------------------------------ */
/* Text report formatter                                              */
/* ------------------------------------------------------------------ */

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fixed(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function compareToFumbbl(
  raceName: string,
  observedTd: number,
  observedCas: number
): string {
  const ref = getFumbblRaceStats(raceName);
  if (!ref) return '';
  const tdOk = isWithinFumbblTolerance(observedTd, ref.tdAverage);
  const casOk = isWithinFumbblTolerance(observedCas, ref.casualtyRate);
  if (tdOk && casOk) {
    return ` [FUMBBL ✓]`;
  }
  return ` [FUMBBL OUTSIDE: TD ${tdOk ? '✓' : '✗'} / CAS ${casOk ? '✓' : '✗'}]`;
}

export function formatBenchReport(pairings: readonly BenchPairing[]): string {
  const lines: string[] = [];
  for (const p of pairings) {
    const m = p.metrics;
    // BUG fix : `m.td.mean` et `m.casualties.mean` sont des totaux par
    // match (home + away). FUMBBL reference est `per race / per match`
    // par équipe. Avant : casualty était passé brut (total/match) alors
    // que TD était divisé par 2 → comparaison incohérente, faux
    // FUMBBL OUTSIDE systématique sur casualty.
    const fumbbl = compareToFumbbl(
      p.pairing.home.race,
      m.td.mean / 2,
      m.casualties.mean / 2
    );
    lines.push('');
    lines.push(`=== ${p.pairing.home.name} (home) vs ${p.pairing.away.name} (away)${fumbbl} ===`);
    lines.push(`  matches      : ${m.matches}`);
    lines.push(
      `  outcomes     : home ${m.outcomes.home} / away ${m.outcomes.away} / draw ${m.outcomes.draw}` +
        (p.favorite ? ` | favorite=${p.favorite} | upset rate ${pct(m.outcomes.upsetRate)}` : '')
    );
    lines.push(
      `  TD/match     : mean ${fixed(m.td.mean)} | std ${fixed(m.td.std)} | p5 ${fixed(m.td.p5)} | p95 ${fixed(m.td.p95)}`
    );
    lines.push(
      `  casualties   : mean ${fixed(m.casualties.mean)} | std ${fixed(m.casualties.std)}`
    );
    lines.push(`  turnovers    : mean ${fixed(m.turnovers.mean)}`);
    lines.push(
      `  fat tails    : >=5 TD ${pct(m.fatTails.highScoring)} | >=4 cas ${pct(m.fatTails.bloodbath)}`
    );
    lines.push(
      `  targets      : std dev TD ${m.meetsTargets.stdDevTd ? '✓' : '✗'} (>= 1.4) | upset rate ${m.meetsTargets.upsetRate ? '✓' : '✗'} (12-18%)`
    );
  }
  return lines.join('\n');
}
