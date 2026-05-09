#!/usr/bin/env tsx
/**
 * `pnpm sim:compare-versions` — Lot 4.B.1.
 *
 * Compare deux snapshots `bench-baseline.json` produits sur des
 * `engineVer` differents et imprime un rapport de drift.
 *
 * Usage typique :
 *   git checkout v0.15.0
 *   pnpm sim:bench:snapshot > /tmp/baseline-0.15.0.json
 *   git checkout v0.16.0
 *   pnpm sim:bench:snapshot > /tmp/baseline-0.16.0.json
 *   pnpm sim:compare-versions \
 *     --base /tmp/baseline-0.15.0.json \
 *     --head /tmp/baseline-0.16.0.json
 *
 * Options
 * -------
 *   --base=<path>        Baseline "ancienne version" (required)
 *   --head=<path>        Baseline "nouvelle version" (required)
 *   --warn=<n>           Threshold relatif warn (default 0.10 = 10%)
 *   --critical=<n>       Threshold relatif critical (default 0.25 = 25%)
 *   --json               Output JSON parsable
 *   --help               Print this help
 *
 * Exit code
 * ---------
 *   0 si aucune severity 'critical', 1 sinon. Permet de gater une
 *   release engine bump dans CI :
 *     pnpm sim:compare-versions --base ... --head ... || echo "drift critical"
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  compareBaselines,
  formatVersionComparisonReport,
  parseBenchBaseline,
} from '../src/index';

const HELP = `pnpm sim:compare-versions — cross-version baseline diff

Usage:
  pnpm sim:compare-versions --base <path> --head <path> [--warn=<n>] [--critical=<n>] [--json]
  pnpm sim:compare-versions --help
`;

interface CliArgs {
  base?: string;
  head?: string;
  warn?: string;
  critical?: string;
  json?: boolean;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      warn: { type: 'string' },
      critical: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
    strict: true,
  });
  return values as CliArgs;
}

function loadBaseline(path: string) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return parseBenchBaseline(raw);
}

function main(argv: readonly string[]): number {
  let args: CliArgs;
  try {
    args = parse(argv);
  } catch (err: unknown) {
    process.stderr.write(`compare-versions: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!args.base || !args.head) {
    process.stderr.write('compare-versions: --base and --head are required\n');
    return 2;
  }
  const base = loadBaseline(args.base);
  const head = loadBaseline(args.head);
  const warn = args.warn !== undefined ? Number.parseFloat(args.warn) : undefined;
  const critical =
    args.critical !== undefined ? Number.parseFloat(args.critical) : undefined;
  if (warn !== undefined && !Number.isFinite(warn)) {
    process.stderr.write('compare-versions: --warn must be a finite number\n');
    return 2;
  }
  if (critical !== undefined && !Number.isFinite(critical)) {
    process.stderr.write('compare-versions: --critical must be a finite number\n');
    return 2;
  }

  const result = compareBaselines(base, head, {
    warnThreshold: warn,
    criticalThreshold: critical,
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(formatVersionComparisonReport(result) + '\n');
  }

  return result.summary.criticalCount > 0 ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
