#!/usr/bin/env tsx
/**
 * `pnpm sim:bench:nightly` — lot 5 « exploitation ».
 *
 * La matrice COMPLÈTE des duels Pro League (16 équipes, 120 rencontres) en
 * full driver, parallélisée sur un pool de `worker_threads`. Trop lourde pour
 * le bench de chaque PR (`sim:bench:ci`, 3 duels × 20 matchs), elle tourne
 * chaque nuit (`.github/workflows/sim-bench-nightly.yml`) et produit :
 *
 *  - le rapport texte habituel (TD, sorties, turnovers, écarts FUMBBL) ;
 *  - un JSON `bench/nightly/<engineVer>.json` (métriques par duel, durée,
 *    CPU par match) pour comparer deux nuits (`sim:compare-versions`).
 *
 * Informatif par défaut : le code de sortie est 0 même hors fourchette
 * FUMBBL. `--gate` rend non-zéro dès qu'un duel sort de la tolérance.
 *
 * Usage
 * -----
 *   pnpm sim:bench:nightly                       # 20 matchs par duel, cpus-1 workers
 *   pnpm sim:bench:nightly --runs=50 --workers=4
 *   pnpm sim:bench:nightly --teams=pit-smashers,kc-soaring-hawks,chi-iron-bears
 *   pnpm sim:bench:nightly --out=/tmp/nightly.json --gate
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { getFumbblRaceStats, isWithinFumbblTolerance } from '../src/bench/fumbbl-reference';
import { formatBenchReport, runBenchMatrixAsync } from '../src/bench/runner';
import { createSimPool } from '../src/pool/sim-pool';
import { PRO_LEAGUE_TEAMS, PRO_LEAGUE_TEAM_BY_ID } from '../src/tactics/race-profiles';
import { ENGINE_VER } from '../src/types';

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

interface CliArgs {
  runs?: string;
  workers?: string;
  teams?: string;
  out?: string;
  seed?: string;
  gate?: boolean;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      runs: { type: 'string' },
      workers: { type: 'string' },
      teams: { type: 'string' },
      out: { type: 'string' },
      seed: { type: 'string' },
      gate: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    strict: true,
  });
  return values as CliArgs;
}

function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive integer`);
  return n;
}

async function main(argv: readonly string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parse(argv);
  } catch (err: unknown) {
    process.stderr.write(`bench-nightly: ${(err as Error).message}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(
      'pnpm sim:bench:nightly — matrice complète en full driver, sur un pool de workers\n\n' +
        'Options:\n' +
        '  --runs=<n>       matchs par duel (défaut 20)\n' +
        '  --workers=<n>    workers (défaut cpus-1)\n' +
        '  --teams=a,b,c    sous-ensemble de slugs (défaut : les 16 équipes)\n' +
        '  --seed=<n>       graine du premier match (défaut 0)\n' +
        '  --out=<path>     JSON de sortie (défaut bench/nightly/<engineVer>.json)\n' +
        '  --gate           code de sortie 1 si un duel sort de la tolérance FUMBBL\n',
    );
    return 0;
  }

  let runs: number;
  let workers: number;
  let seed: number;
  try {
    runs = positiveInt(args.runs, 20, 'runs');
    workers = positiveInt(args.workers, Math.max(1, os.availableParallelism() - 1), 'workers');
    seed = args.seed === undefined ? 0 : Number.parseInt(args.seed, 10);
    if (!Number.isInteger(seed) || seed < 0) throw new Error('--seed must be a non-negative integer');
  } catch (err: unknown) {
    process.stderr.write(`bench-nightly: ${(err as Error).message}\n`);
    return 2;
  }

  const teams = args.teams
    ? args.teams.split(',').map((slug) => {
        const t = PRO_LEAGUE_TEAM_BY_ID[slug.trim()];
        if (!t) throw new Error(`bench-nightly: équipe inconnue '${slug}'`);
        return t;
      })
    : [...PRO_LEAGUE_TEAMS];
  const pairingsCount = (teams.length * (teams.length - 1)) / 2;
  process.stdout.write(
    `Nightly bench ${ENGINE_VER} — ${teams.length} équipes, ${pairingsCount} duels × ${runs} matchs, ${workers} workers\n`,
  );

  const pool = createSimPool({ size: workers, defaults: { stripFullReplay: true } });
  const t0 = performance.now();
  let outOfTolerance = 0;
  try {
    const matrix = await runBenchMatrixAsync(
      { teams, runs, seedOffset: seed, driverKind: 'full' },
      (sim, options) => pool.simulate(sim, options),
    );
    const elapsedMs = performance.now() - t0;
    const matches = pairingsCount * runs;
    process.stdout.write(formatBenchReport(matrix.pairings) + '\n');
    process.stdout.write(
      `\n${matches} matchs en ${(elapsedMs / 1000).toFixed(1)} s (${(elapsedMs / matches).toFixed(0)} ms par match, ${workers} workers, ${((elapsedMs * workers) / matches).toFixed(0)} ms CPU par match)\n`,
    );

    const pairings = matrix.pairings.map((p) => {
      const homeRef = getFumbblRaceStats(p.pairing.home.race);
      const awayRef = getFumbblRaceStats(p.pairing.away.race);
      const tdPerTeam = p.metrics.td.mean / 2;
      const within =
        (!homeRef || isWithinFumbblTolerance(tdPerTeam, homeRef.tdPerMatch)) &&
        (!awayRef || isWithinFumbblTolerance(tdPerTeam, awayRef.tdPerMatch));
      if (!within) outOfTolerance += 1;
      return {
        homeId: p.pairing.home.id,
        awayId: p.pairing.away.id,
        matches: p.matches,
        favorite: p.favorite ?? null,
        metrics: p.metrics,
        withinFumbblTd: within,
      };
    });
    const out = {
      engineVer: ENGINE_VER,
      generatedAt: new Date().toISOString(),
      driverKind: 'full',
      runs,
      seedOffset: seed,
      workers,
      elapsedMs: Math.round(elapsedMs),
      cpuMsPerMatch: Math.round((elapsedMs * workers) / matches),
      pairings,
    };
    const outPath = args.out ?? resolve(PACKAGE_ROOT, `bench/nightly/${ENGINE_VER}.json`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
    process.stdout.write(`Rapport JSON : ${outPath}\n`);
    process.stdout.write(
      `${pairings.length - outOfTolerance}/${pairings.length} duels dans la fourchette FUMBBL (TD par équipe)\n`,
    );
  } finally {
    await pool.close();
  }
  return args.gate && outOfTolerance > 0 ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`bench-nightly: ${(err as Error).message}\n`);
    process.exitCode = 2;
  },
);
