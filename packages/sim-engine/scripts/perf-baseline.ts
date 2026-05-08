#!/usr/bin/env tsx
/**
 * `pnpm sim:perf` — Lot 3.B.3.
 *
 * Imprime un rapport perf hybrid + full pour un pairing donné.
 * Sert :
 *  - aux dev locaux : "ma refacto a-t-elle ralenti le full driver ?"
 *  - aux release notes : capturer mean/p95 sur 5-10 runs.
 *
 * Le test vitest `perf-baseline.smoke.test.ts` couvre déjà les SLO en
 * CI ; ce script est purement informatif (pas de seuil, pas d'exit code
 * sur degradation — laisse au dev le soin de comparer).
 *
 * Usage examples
 * --------------
 *   pnpm sim:perf
 *   pnpm sim:perf --teamA=pit-smashers --teamB=kc-soaring-hawks --runs=10
 *   pnpm sim:perf --json
 *
 * Options
 *   --teamA=<id>   Home slug (default 'pit-smashers')
 *   --teamB=<id>   Away slug (default 'kc-soaring-hawks')
 *   --runs=<n>     Runs par driver (default 5, max 50)
 *   --seed=<n>     Seed (default 1, déterministe)
 *   --json         Output JSON parsable
 *   --help         Print this help
 */

import { parseArgs } from 'node:util';

import { measureSimulationPerf } from '../src/perf/perf-baseline';
import { PRO_LEAGUE_TEAM_BY_ID } from '../src/tactics/race-profiles';
import type { SimInput } from '../src/types';

const HELP = `pnpm sim:perf — perf baseline hybrid + full

Usage:
  pnpm sim:perf [--teamA=<slug>] [--teamB=<slug>] [--runs=<n>] [--seed=<n>] [--json]
  pnpm sim:perf --help
`;

interface CliArgs {
  teamA?: string;
  teamB?: string;
  runs?: string;
  seed?: string;
  json?: boolean;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      teamA: { type: 'string' },
      teamB: { type: 'string' },
      runs: { type: 'string' },
      seed: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
    strict: true,
  });
  return values as CliArgs;
}

function fmt(ms: number): string {
  return ms.toFixed(1).padStart(7, ' ');
}

function main(argv: readonly string[]): void {
  let args: CliArgs;
  try {
    args = parse(argv);
  } catch (err: unknown) {
    process.stderr.write(`perf: ${(err as Error).message}\n\n${HELP}`);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const teamAId = args.teamA ?? 'pit-smashers';
  const teamBId = args.teamB ?? 'kc-soaring-hawks';
  const home = PRO_LEAGUE_TEAM_BY_ID[teamAId];
  const away = PRO_LEAGUE_TEAM_BY_ID[teamBId];
  if (!home) {
    process.stderr.write(`perf: unknown teamA '${teamAId}'\n`);
    process.exit(2);
  }
  if (!away) {
    process.stderr.write(`perf: unknown teamB '${teamBId}'\n`);
    process.exit(2);
  }
  const runs = Math.min(50, Math.max(1, args.runs ? Number.parseInt(args.runs, 10) : 5));
  const seed = args.seed ? Number.parseInt(args.seed, 10) : 1;

  const input: SimInput = {
    seed,
    home: { id: home.id, name: home.name, side: 'home' },
    away: { id: away.id, name: away.name, side: 'away' },
  } as SimInput;

  const hybrid = measureSimulationPerf({ input, driverKind: 'hybrid', runs });
  const full = measureSimulationPerf({ input, driverKind: 'full', runs });
  const ratio = full.p95 / Math.max(1, hybrid.p95);

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          teamA: home.id,
          teamB: away.id,
          runs,
          seed,
          hybrid: {
            mean: hybrid.mean,
            p50: hybrid.p50,
            p95: hybrid.p95,
            max: hybrid.max,
          },
          full: {
            mean: full.mean,
            p50: full.p50,
            p95: full.p95,
            max: full.max,
          },
          ratioFullOverHybrid: ratio,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  process.stdout.write(
    `\nperf baseline (${home.id} vs ${away.id}, runs=${runs}, seed=${seed})\n` +
      `  driver        mean       p50       p95       max\n` +
      `  hybrid    ${fmt(hybrid.mean)}   ${fmt(hybrid.p50)}   ${fmt(hybrid.p95)}   ${fmt(hybrid.max)} ms\n` +
      `  full      ${fmt(full.mean)}   ${fmt(full.p50)}   ${fmt(full.p95)}   ${fmt(full.max)} ms\n` +
      `  ratio full.p95 / hybrid.p95 = ${ratio.toFixed(1)}×\n`,
  );
}

main(process.argv.slice(2));
