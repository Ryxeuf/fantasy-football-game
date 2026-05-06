#!/usr/bin/env tsx
/**
 * `pnpm sim:bench:ci` — sprint Pro League 0.D.4.
 *
 * Runs every pairing declared in `bench/bench-baseline.json` against the
 * current sim engine and exits with a non-zero status if any metric
 * deviates beyond the configured tolerance (sprint default: 5%).
 *
 * Used by the GitHub Actions workflow `.github/workflows/sim-bench.yml`
 * to alert on sim engine regressions.
 *
 * Usage
 * -----
 *   pnpm sim:bench:ci                            # uses bench/bench-baseline.json
 *   pnpm sim:bench:ci --baseline=path/to/file    # custom baseline path
 *   pnpm sim:bench:ci --runs=5000                # override runs in the baseline
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PRO_LEAGUE_TEAM_BY_ID } from '../src/tactics/race-profiles';

import {
  compareToBaseline,
  formatBaselineReport,
  parseBenchBaseline,
  type BaselineLineItem,
} from '../src/bench/baseline';
import { runBench } from '../src/bench/runner';

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const DEFAULT_BASELINE_PATH = resolve(PACKAGE_ROOT, 'bench/bench-baseline.json');

interface CliArgs {
  baseline?: string;
  runs?: string;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      baseline: { type: 'string' },
      runs: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
  });
  return values as CliArgs;
}

function main(argv: readonly string[]): number {
  let args: CliArgs;
  try {
    args = parse(argv);
  } catch (err: unknown) {
    process.stderr.write(`bench-ci: ${(err as Error).message}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(
      'pnpm sim:bench:ci — Pro League sim engine regression gate\n\n' +
        'Options:\n' +
        '  --baseline=<path>   Path to the baseline JSON (default: bench/bench-baseline.json)\n' +
        '  --runs=<n>          Override runs in the baseline\n' +
        '  --help              Print this help\n'
    );
    return 0;
  }

  const baselinePath = args.baseline ?? DEFAULT_BASELINE_PATH;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch (err: unknown) {
    process.stderr.write(`bench-ci: cannot read baseline at ${baselinePath} : ${(err as Error).message}\n`);
    return 2;
  }

  let baseline;
  try {
    baseline = parseBenchBaseline(raw);
  } catch (err: unknown) {
    process.stderr.write(`bench-ci: invalid baseline format: ${(err as Error).message}\n`);
    return 2;
  }

  const runsOverride = args.runs ? Number.parseInt(args.runs, 10) : undefined;
  if (runsOverride !== undefined && (!Number.isInteger(runsOverride) || runsOverride <= 0)) {
    process.stderr.write('bench-ci: --runs must be a positive integer\n');
    return 2;
  }

  process.stdout.write(`Running sim:bench:ci against baseline ${baseline.engineVer} (${baseline.snapshotAt})\n`);
  process.stdout.write(`Tolerance default: ${(baseline.tolerance * 100).toFixed(1)}%\n\n`);

  const items: BaselineLineItem[] = [];
  let allPassed = true;
  for (const entry of baseline.pairings) {
    const home = PRO_LEAGUE_TEAM_BY_ID[entry.homeId];
    const away = PRO_LEAGUE_TEAM_BY_ID[entry.awayId];
    if (!home || !away) {
      process.stderr.write(`bench-ci: unknown team in baseline (homeId=${entry.homeId}, awayId=${entry.awayId})\n`);
      return 2;
    }
    const runs = runsOverride ?? entry.runs;
    const out = runBench({
      pairing: { home, away },
      runs,
      seedOffset: entry.seedOffset,
    });
    const result = compareToBaseline(out.metrics, entry, baseline.tolerance);
    items.push({ entry, result });
    if (!result.passed) allPassed = false;
  }

  process.stdout.write(formatBaselineReport(items) + '\n');
  return allPassed ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
