#!/usr/bin/env tsx
/**
 * `pnpm sim:bench:snapshot` — sprint Pro League 0.D.4.
 *
 * Re-captures full-precision metrics for the pairings in the bundled
 * baseline and prints a fresh `bench-baseline.json` to stdout. Use
 * after a deliberate engine change : pipe to the file and bump
 * `engineVer`. The CI gate (`pnpm sim:bench:ci`) then validates that
 * future PRs do not drift from this snapshot beyond the tolerance.
 *
 * Usage
 * -----
 *   pnpm sim:bench:snapshot > bench/bench-baseline.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PRO_LEAGUE_TEAM_BY_ID } from '../src/tactics/race-profiles';

import {
  parseBenchBaseline,
  type BenchBaseline,
  type BenchBaselineEntry,
} from '../src/bench/baseline';
import { runBench } from '../src/bench/runner';
import { ENGINE_VER } from '../src/types';

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const DEFAULT_BASELINE_PATH = resolve(PACKAGE_ROOT, 'bench/bench-baseline.json');

function snapshotEntry(entry: BenchBaselineEntry): BenchBaselineEntry {
  const home = PRO_LEAGUE_TEAM_BY_ID[entry.homeId];
  const away = PRO_LEAGUE_TEAM_BY_ID[entry.awayId];
  if (!home || !away) {
    throw new Error(`Unknown team in baseline (${entry.homeId} / ${entry.awayId})`);
  }
  const result = runBench({
    pairing: { home, away },
    runs: entry.runs,
    seedOffset: entry.seedOffset,
  });
  const m = result.metrics;
  const total = m.outcomes.home + m.outcomes.away + m.outcomes.draw;
  return {
    homeId: entry.homeId,
    awayId: entry.awayId,
    runs: entry.runs,
    seedOffset: entry.seedOffset,
    expected: {
      tdMean: m.td.mean,
      tdStd: m.td.std,
      casualtyMean: m.casualties.mean,
      turnoverMean: m.turnovers.mean,
      homeWinRate: m.outcomes.home / total,
      awayWinRate: m.outcomes.away / total,
      drawRate: m.outcomes.draw / total,
    },
    ...(entry.tolerance !== undefined ? { tolerance: entry.tolerance } : {}),
  };
}

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      apply: { type: 'boolean' },
    },
    strict: true,
  });
  const apply = values.apply === true;
  const raw = JSON.parse(readFileSync(DEFAULT_BASELINE_PATH, 'utf8'));
  const baseline = parseBenchBaseline(raw);
  const refreshed: BenchBaseline = {
    engineVer: ENGINE_VER,
    snapshotAt: new Date().toISOString().slice(0, 10),
    tolerance: baseline.tolerance,
    pairings: baseline.pairings.map(snapshotEntry),
  };
  const serialized = JSON.stringify(refreshed, null, 2) + '\n';
  if (apply) {
    writeFileSync(DEFAULT_BASELINE_PATH, serialized, 'utf8');
    process.stderr.write(`Wrote ${DEFAULT_BASELINE_PATH}\n`);
  } else {
    process.stdout.write(serialized);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
