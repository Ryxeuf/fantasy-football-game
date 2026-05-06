#!/usr/bin/env tsx
/**
 * `pnpm sim:bench` — sprint Pro League 0.D.1.
 *
 * Usage examples
 * --------------
 *   pnpm sim:bench --teamA=pit-smashers --teamB=kc-soaring-hawks --runs=1000
 *   pnpm sim:bench --matrix --runs=200
 *   pnpm sim:bench --teamA=pit-smashers --teamB=kc-soaring-hawks --runs=10000 --seed=42
 *
 * Options
 *   --teamA=<id>       home team slug (cf. PRO_LEAGUE_TEAMS)
 *   --teamB=<id>       away team slug
 *   --runs=<n>         number of matches per pairing (positive integer)
 *   --matrix           run all-vs-all over PRO_LEAGUE_TEAMS (overrides --teamA/--teamB)
 *   --seed=<n>         seed offset for the first match (default 0)
 *   --help             print this help and exit
 *
 * Output : a text report with TD/casualty/turnover stats, fat-tails,
 * outcome distribution + sprint-target flags + FUMBBL deviation
 * annotations (lot 0.D.2).
 *
 * Note : single-threaded ; worker_threads parallelism is a follow-up
 * once the bench is regularly invoked from CI (lot 0.D.4) and runtime
 * becomes the bottleneck.
 */

import { parseArgs } from 'node:util';

import {
  PRO_LEAGUE_TEAMS,
  PRO_LEAGUE_TEAM_BY_ID,
} from '../src/tactics/race-profiles';

import {
  formatBenchReport,
  runBench,
  runBenchMatrix,
} from '../src/bench/runner';

const HELP = `pnpm sim:bench — Pro League sim engine bench harness

Usage:
  pnpm sim:bench --teamA=<slug> --teamB=<slug> --runs=<n> [--seed=<n>]
  pnpm sim:bench --matrix --runs=<n> [--seed=<n>]
  pnpm sim:bench --help

Options:
  --teamA=<slug>     Home team id (e.g. 'pit-smashers')
  --teamB=<slug>     Away team id (e.g. 'kc-soaring-hawks')
  --runs=<n>         Matches per pairing (positive integer)
  --matrix           All-vs-all matrix on PRO_LEAGUE_TEAMS
  --seed=<n>         Seed offset (default 0 — bench is replay-deterministic)
  --help             Print this help and exit
`;

interface CliArgs {
  teamA?: string;
  teamB?: string;
  runs?: string;
  matrix?: boolean;
  seed?: string;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      teamA: { type: 'string' },
      teamB: { type: 'string' },
      runs: { type: 'string' },
      matrix: { type: 'boolean' },
      seed: { type: 'string' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
    strict: true,
  });
  return values as CliArgs;
}

function requireInt(name: string, raw: string | undefined): number {
  if (raw === undefined) throw new Error(`Missing --${name}`);
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return n;
}

function main(argv: readonly string[]): void {
  let args: CliArgs;
  try {
    args = parse(argv);
  } catch (err: unknown) {
    process.stderr.write(`bench: ${(err as Error).message}\n\n${HELP}`);
    process.exit(2);
  }

  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const seed = args.seed !== undefined ? Number.parseInt(args.seed, 10) : 0;
  if (!Number.isFinite(seed)) {
    process.stderr.write('bench: --seed must be a finite integer\n');
    process.exit(2);
  }

  if (args.matrix) {
    const runs = requireInt('runs', args.runs);
    const matrix = runBenchMatrix({
      teams: PRO_LEAGUE_TEAMS,
      runs,
      seedOffset: seed,
    });
    process.stdout.write(formatBenchReport(matrix.pairings) + '\n');
    return;
  }

  const teamAId = args.teamA;
  const teamBId = args.teamB;
  if (!teamAId || !teamBId) {
    process.stderr.write('bench: --teamA and --teamB are required (or use --matrix)\n');
    process.exit(2);
  }
  const runs = requireInt('runs', args.runs);
  const home = PRO_LEAGUE_TEAM_BY_ID[teamAId];
  const away = PRO_LEAGUE_TEAM_BY_ID[teamBId];
  if (!home) {
    process.stderr.write(`bench: unknown teamA '${teamAId}'\n`);
    process.exit(2);
  }
  if (!away) {
    process.stderr.write(`bench: unknown teamB '${teamBId}'\n`);
    process.exit(2);
  }

  const out = runBench({ pairing: { home, away }, runs, seedOffset: seed });
  process.stdout.write(formatBenchReport([out]) + '\n');
}

main(process.argv.slice(2));
