#!/usr/bin/env tsx
/**
 * `pnpm sim:compare` — Lot 3.B.2.
 *
 * Compare hybrid vs full driver sur N matchs avec le même seed et
 * imprime un rapport text ou JSON. Sert :
 *  - aux PR reviews : "le full driver tient-il les stats du hybrid ?"
 *  - aux release notes : drift score / outcome flip rate
 *  - aux investigations : repérer les seeds qui font diverger fort
 *    (vu sur stdout en mode `--verbose`)
 *
 * Usage examples
 * --------------
 *   pnpm sim:compare --teamA=pit-smashers --teamB=kc-soaring-hawks --matches=50
 *   pnpm sim:compare --matrix --matches=10 --json
 *   pnpm sim:compare --teamA=pit-smashers --teamB=kc-soaring-hawks --matches=200 --seed=42
 *
 * Options
 *   --teamA=<id>      Home team slug (cf. PRO_LEAGUE_TEAMS)
 *   --teamB=<id>      Away team slug
 *   --matches=<n>     Nombre de matchs par pairing (positive integer, default 25)
 *   --matrix          All-vs-all matrix sur PRO_LEAGUE_TEAMS (override teamA/teamB)
 *   --seed=<n>        Seed offset (default 0 — déterministe)
 *   --json            Imprime un JSON parsable au lieu du rapport texte
 *   --verbose         Affiche aussi les seeds avec scoreTotal>=2 (debug)
 *   --help            Print this help and exit
 *
 * Note : single-threaded, ~1s/match en `full` ⇒ 50 matchs ≈ 50s. Le
 * comparator utilise le même seed pour les deux drivers, donc une
 * différence est purement liée à l'algorithme et pas au RNG.
 */

import { parseArgs } from 'node:util';

import {
  aggregateComparisons,
  compareDriversOnce,
} from '../src/compare/compare-drivers';
import {
  PRO_LEAGUE_TEAMS,
  PRO_LEAGUE_TEAM_BY_ID,
  type ProTeamProfile,
} from '../src/tactics/race-profiles';
import type { ComparisonAggregate, ComparisonRun } from '../src/compare/compare-drivers';
import type { SimInput } from '../src/types';

const HELP = `pnpm sim:compare — hybrid vs full driver comparator

Usage:
  pnpm sim:compare --teamA=<slug> --teamB=<slug> --matches=<n> [--seed=<n>] [--json|--verbose]
  pnpm sim:compare --matrix --matches=<n> [--seed=<n>] [--json]
  pnpm sim:compare --help

Options:
  --teamA=<slug>     Home team id (e.g. 'pit-smashers')
  --teamB=<slug>     Away team id (e.g. 'kc-soaring-hawks')
  --matches=<n>      Matches per pairing (default 25)
  --matrix           All-vs-all on PRO_LEAGUE_TEAMS
  --seed=<n>         Seed offset (default 0)
  --json             Output JSON (machine-readable)
  --verbose          Print outlier seeds (scoreTotal >= 2)
  --help             Print this help
`;

interface CliArgs {
  teamA?: string;
  teamB?: string;
  matches?: string;
  matrix?: boolean;
  seed?: string;
  json?: boolean;
  verbose?: boolean;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      teamA: { type: 'string' },
      teamB: { type: 'string' },
      matches: { type: 'string' },
      matrix: { type: 'boolean' },
      seed: { type: 'string' },
      json: { type: 'boolean' },
      verbose: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
    strict: true,
  });
  return values as CliArgs;
}

function buildSimInput(
  home: ProTeamProfile,
  away: ProTeamProfile,
  seed: number
): SimInput {
  return {
    seed,
    home: { id: home.id, name: home.name, side: 'home' },
    away: { id: away.id, name: away.name, side: 'away' },
  };
}

interface PairingReport {
  readonly home: string;
  readonly away: string;
  readonly aggregate: ComparisonAggregate;
  readonly outliers: ReadonlyArray<{
    readonly seed: number;
    readonly scoreTotal: number;
    readonly outcomeChanged: boolean;
  }>;
}

function runPairing(
  home: ProTeamProfile,
  away: ProTeamProfile,
  matches: number,
  seedOffset: number,
  collectOutliers: boolean
): PairingReport {
  const runs: ComparisonRun[] = [];
  const outliers: Array<{
    seed: number;
    scoreTotal: number;
    outcomeChanged: boolean;
  }> = [];
  for (let i = 0; i < matches; i++) {
    const seed = seedOffset + i;
    const run = compareDriversOnce(buildSimInput(home, away, seed));
    runs.push(run);
    if (
      collectOutliers &&
      (run.deltas.scoreTotal >= 2 || run.deltas.outcomeChanged)
    ) {
      outliers.push({
        seed,
        scoreTotal: run.deltas.scoreTotal,
        outcomeChanged: run.deltas.outcomeChanged,
      });
    }
  }
  return {
    home: home.id,
    away: away.id,
    aggregate: aggregateComparisons(runs),
    outliers,
  };
}

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : 'NaN';
}

function formatPairing(p: PairingReport, verbose: boolean): string {
  const a = p.aggregate;
  const lines: string[] = [
    `\n=== ${p.home} vs ${p.away} (matches=${a.matches}) ===`,
    `  scoreTotal      mean=${fmt(a.scoreTotal.mean)}  p50=${fmt(a.scoreTotal.p50)}  p95=${fmt(a.scoreTotal.p95)}  max=${fmt(a.scoreTotal.max, 0)}`,
    `  turnoverCount   mean=${fmt(a.turnoverCount.mean)}  p95=${fmt(a.turnoverCount.p95)}  max=${fmt(a.turnoverCount.max, 0)}`,
    `  touchdownCount  mean=${fmt(a.touchdownCount.mean)}  p95=${fmt(a.touchdownCount.p95)}  max=${fmt(a.touchdownCount.max, 0)}`,
    `  casualtyCount   mean=${fmt(a.casualtyCount.mean)}  p95=${fmt(a.casualtyCount.p95)}  max=${fmt(a.casualtyCount.max, 0)}`,
    `  outcomeFlipped  ${a.outcomeFlippedCount}/${a.matches}  (${fmt((a.outcomeFlippedCount / Math.max(1, a.matches)) * 100, 1)}%)`,
    `  divergedPct     ${fmt(a.divergedPct * 100, 1)}%`,
  ];
  if (verbose && p.outliers.length > 0) {
    lines.push('  outliers (scoreTotal>=2 or outcomeChanged):');
    for (const o of p.outliers.slice(0, 20)) {
      lines.push(
        `    seed=${o.seed}  scoreTotal=${o.scoreTotal}  outcomeChanged=${o.outcomeChanged}`
      );
    }
    if (p.outliers.length > 20) {
      lines.push(`    … (${p.outliers.length - 20} more)`);
    }
  }
  return lines.join('\n');
}

function requireInt(name: string, raw: string | undefined, dflt?: number): number {
  if (raw === undefined) {
    if (dflt !== undefined) return dflt;
    throw new Error(`Missing --${name}`);
  }
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
    process.stderr.write(`compare: ${(err as Error).message}\n\n${HELP}`);
    process.exit(2);
  }

  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const matches = requireInt('matches', args.matches, 25);
  const seed = args.seed !== undefined ? Number.parseInt(args.seed, 10) : 0;
  if (!Number.isFinite(seed)) {
    process.stderr.write('compare: --seed must be a finite integer\n');
    process.exit(2);
  }
  const verbose = !!args.verbose;
  const json = !!args.json;

  const reports: PairingReport[] = [];
  if (args.matrix) {
    for (const home of PRO_LEAGUE_TEAMS) {
      for (const away of PRO_LEAGUE_TEAMS) {
        if (home.id === away.id) continue;
        reports.push(runPairing(home, away, matches, seed, verbose));
      }
    }
  } else {
    if (!args.teamA || !args.teamB) {
      process.stderr.write(
        'compare: --teamA and --teamB are required (or use --matrix)\n'
      );
      process.exit(2);
    }
    const home = PRO_LEAGUE_TEAM_BY_ID[args.teamA];
    const away = PRO_LEAGUE_TEAM_BY_ID[args.teamB];
    if (!home) {
      process.stderr.write(`compare: unknown teamA '${args.teamA}'\n`);
      process.exit(2);
    }
    if (!away) {
      process.stderr.write(`compare: unknown teamB '${args.teamB}'\n`);
      process.exit(2);
    }
    reports.push(runPairing(home, away, matches, seed, verbose));
  }

  if (json) {
    process.stdout.write(
      JSON.stringify(
        { generatedAt: new Date().toISOString(), seedOffset: seed, matches, reports },
        null,
        2
      ) + '\n'
    );
    return;
  }

  process.stdout.write(reports.map((r) => formatPairing(r, verbose)).join('\n'));
  process.stdout.write('\n');
}

main(process.argv.slice(2));
