#!/usr/bin/env tsx
/**
 * `pnpm sim:replay` — sprint Pro League 0.E.2.
 *
 * Sample N matchs Pro League aleatoires, sortis en format texte
 * narratif lisible pour le panel humain BB experts (lot 0.E.3).
 *
 * Usage examples
 * --------------
 *   pnpm sim:replay --random=50
 *   pnpm sim:replay --random=50 --out=tmp/replays
 *   pnpm sim:replay --random=20 --seed=2024  # bias the seed offset
 *   pnpm sim:replay --teamA=pit-smashers --teamB=kc-soaring-hawks --runs=5
 *
 * Options
 *   --random=<n>      Sample n random pairings (different team pairs +
 *                     different seeds). Conflicts with --teamA/--teamB.
 *   --teamA=<id>      Single pairing — explicit home team
 *   --teamB=<id>      Single pairing — explicit away team
 *   --runs=<n>        Number of replays per pairing (default 1).
 *   --seed=<n>        Base seed offset (default 0). Replays use
 *                     consecutive seeds starting from this value so
 *                     re-running with the same seed reproduces the set.
 *   --out=<dir>       Optional output directory ; writes one .txt file
 *                     per replay. Otherwise prints all replays to stdout.
 *   --hide-footer     Skip the FINAL summary line (useful when piping).
 *   --help            Print this help and exit.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { createRng } from '../src/rng/seeded';
import { simulateMatch } from '../src/simulate-match';
import {
  PRO_LEAGUE_TEAMS,
  PRO_LEAGUE_TEAM_BY_ID,
  type ProTeamProfile,
} from '../src/tactics/race-profiles';
import type { SimInput, SimTeamInput } from '../src/types';

import { narrateMatch } from '../src/replay/narrator';

const HELP = `pnpm sim:replay — Pro League replay sampler (panel BB experts)

Usage:
  pnpm sim:replay --random=<n> [--seed=<n>] [--out=<dir>]
  pnpm sim:replay --teamA=<id> --teamB=<id> [--runs=<n>] [--seed=<n>] [--out=<dir>]
  pnpm sim:replay --help

Options:
  --random=<n>      Sample n random pairings (replay-deterministic via --seed)
  --teamA=<id>      Single pairing — home team
  --teamB=<id>      Single pairing — away team
  --runs=<n>        Replays per pairing (default 1)
  --seed=<n>        Base seed offset (default 0)
  --out=<dir>       Write one .txt per replay instead of printing to stdout
  --hide-footer     Skip the FINAL summary line
  --help            Print this help
`;

interface CliArgs {
  random?: string;
  teamA?: string;
  teamB?: string;
  runs?: string;
  seed?: string;
  out?: string;
  'hide-footer'?: boolean;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      random: { type: 'string' },
      teamA: { type: 'string' },
      teamB: { type: 'string' },
      runs: { type: 'string' },
      seed: { type: 'string' },
      out: { type: 'string' },
      'hide-footer': { type: 'boolean' },
      help: { type: 'boolean' },
    },
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

interface Pairing {
  home: ProTeamProfile;
  away: ProTeamProfile;
  seed: number;
  index: number;
}

function buildRandomPairings(count: number, baseSeed: number): Pairing[] {
  const rng = createRng(baseSeed);
  const out: Pairing[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    attempts += 1;
    const i = Math.floor(rng.next() * PRO_LEAGUE_TEAMS.length);
    let j = Math.floor(rng.next() * PRO_LEAGUE_TEAMS.length);
    if (i === j) j = (j + 1) % PRO_LEAGUE_TEAMS.length;
    const home = PRO_LEAGUE_TEAMS[i];
    const away = PRO_LEAGUE_TEAMS[j];
    const key = `${home.id}|${away.id}|${baseSeed + out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ home, away, seed: baseSeed + out.length, index: out.length + 1 });
  }
  return out;
}

function buildSinglePairings(
  teamAId: string,
  teamBId: string,
  runs: number,
  baseSeed: number
): Pairing[] {
  const home = PRO_LEAGUE_TEAM_BY_ID[teamAId];
  const away = PRO_LEAGUE_TEAM_BY_ID[teamBId];
  if (!home) throw new Error(`Unknown teamA '${teamAId}'`);
  if (!away) throw new Error(`Unknown teamB '${teamBId}'`);
  if (teamAId === teamBId) {
    throw new Error('teamA and teamB must be distinct');
  }
  return Array.from({ length: runs }, (_, i) => ({
    home,
    away,
    seed: baseSeed + i,
    index: i + 1,
  }));
}

function toSimTeamInput(team: ProTeamProfile, side: 'home' | 'away'): SimTeamInput {
  return {
    id: team.id,
    name: team.name,
    side,
    tactics: team.tactics,
  };
}

function slugForFile(p: Pairing): string {
  const safe = (s: string) => s.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const idx = String(p.index).padStart(3, '0');
  return `replay-${idx}-${safe(p.home.id)}-vs-${safe(p.away.id)}-seed${p.seed}.txt`;
}

function main(argv: readonly string[]): number {
  let args: CliArgs;
  try {
    args = parse(argv);
  } catch (err: unknown) {
    process.stderr.write(`replay: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const seed = args.seed !== undefined ? Number.parseInt(args.seed, 10) : 0;
  if (!Number.isFinite(seed) || seed < 0) {
    process.stderr.write('replay: --seed must be a non-negative integer\n');
    return 2;
  }

  let pairings: Pairing[];
  try {
    if (args.random) {
      const n = requireInt('random', args.random);
      pairings = buildRandomPairings(n, seed);
    } else {
      if (!args.teamA || !args.teamB) {
        process.stderr.write('replay: provide --random=<n> OR --teamA + --teamB\n');
        return 2;
      }
      const runs = args.runs ? requireInt('runs', args.runs) : 1;
      pairings = buildSinglePairings(args.teamA, args.teamB, runs, seed);
    }
  } catch (err: unknown) {
    process.stderr.write(`replay: ${(err as Error).message}\n`);
    return 2;
  }

  const outDir = args.out;
  if (outDir) mkdirSync(outDir, { recursive: true });

  for (const p of pairings) {
    const sim: SimInput = {
      seed: p.seed,
      home: toSimTeamInput(p.home, 'home'),
      away: toSimTeamInput(p.away, 'away'),
    };
    const result = simulateMatch(sim);
    const title = `MATCH #${p.index} — ${p.home.name} (${p.home.race}) vs ${p.away.name} (${p.away.race})`;
    const text = narrateMatch(result, {
      title,
      hideFooter: args['hide-footer'],
    });
    if (outDir) {
      const path = resolve(outDir, slugForFile(p));
      writeFileSync(path, text + '\n', 'utf8');
      process.stdout.write(`Wrote ${path}\n`);
    } else {
      process.stdout.write(text + '\n\n');
    }
  }

  if (!outDir) {
    process.stdout.write(`# ${pairings.length} replay(s) sampled.\n`);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
