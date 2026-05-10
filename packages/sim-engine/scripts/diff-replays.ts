#!/usr/bin/env tsx
/**
 * `pnpm sim:diff-replays` — Lot 4.B.2.
 *
 * Compare deux replays (events JSON) et imprime un rapport de
 * divergence event-par-event. Utile pour debugger une regression
 * deterministe entre deux engineVer ou deux refacto du driver.
 *
 * Usage typique :
 *   git checkout v0.15.0
 *   pnpm sim:replay --seed=42 --teamA=pit-smashers --teamB=kc-soaring-hawks --json > /tmp/replay-0.15.json
 *   git checkout v0.16.0
 *   pnpm sim:replay --seed=42 --teamA=pit-smashers --teamB=kc-soaring-hawks --json > /tmp/replay-0.16.json
 *   pnpm sim:diff-replays --a /tmp/replay-0.15.json --b /tmp/replay-0.16.json
 *
 * Format d'entree
 * ---------------
 * Chaque fichier doit etre un JSON top-level avec un champ
 * `events: MatchEvent[]`. Compatible avec la sortie de `pnpm sim:replay
 * --json` et avec un dump direct de `SimResult`.
 *
 * Options
 * -------
 *   --a=<path>            Replay A (required)
 *   --b=<path>            Replay B (required)
 *   --max-divergences=<n> Cap des divergences stockees (default 200)
 *   --max-lines=<n>       Cap des lignes affichees (default 20)
 *   --json                Output JSON parsable
 *   --help                Print this help
 *
 * Exit code
 * ---------
 *   0 si aucune divergence, 1 sinon. Permet de gater une release dans
 *   CI : `pnpm sim:diff-replays ... || fail`.
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  diffReplayEvents,
  formatReplayDiffReport,
} from '../src/replay/replay-diff';
import type { MatchEvent } from '../src/types';

const HELP = `pnpm sim:diff-replays — replay event-by-event diff

Usage:
  pnpm sim:diff-replays --a <path> --b <path> [--max-divergences=<n>] [--max-lines=<n>] [--json]
  pnpm sim:diff-replays --help
`;

interface CliArgs {
  a?: string;
  b?: string;
  'max-divergences'?: string;
  'max-lines'?: string;
  json?: boolean;
  help?: boolean;
}

function parse(argv: readonly string[]): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      a: { type: 'string' },
      b: { type: 'string' },
      'max-divergences': { type: 'string' },
      'max-lines': { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
    strict: true,
  });
  return values as CliArgs;
}

function loadReplayEvents(path: string): readonly MatchEvent[] {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid replay file ${path}: not an object`);
  }
  const events = (raw as { events?: unknown }).events;
  if (!Array.isArray(events)) {
    throw new Error(`Invalid replay file ${path}: missing events array`);
  }
  return events as readonly MatchEvent[];
}

function parsePositiveInt(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return n;
}

function main(argv: readonly string[]): number {
  let args: CliArgs;
  try {
    args = parse(argv);
  } catch (err: unknown) {
    process.stderr.write(`diff-replays: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!args.a || !args.b) {
    process.stderr.write('diff-replays: --a and --b are required\n');
    return 2;
  }

  let maxDivergences: number | undefined;
  let maxLines: number | undefined;
  try {
    maxDivergences = parsePositiveInt('max-divergences', args['max-divergences']);
    maxLines = parsePositiveInt('max-lines', args['max-lines']);
  } catch (err: unknown) {
    process.stderr.write(`diff-replays: ${(err as Error).message}\n`);
    return 2;
  }

  const eventsA = loadReplayEvents(args.a);
  const eventsB = loadReplayEvents(args.b);
  const result = diffReplayEvents(eventsA, eventsB, { maxDivergences });

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(
      formatReplayDiffReport(result, { maxLinesShown: maxLines }) + '\n',
    );
  }

  return result.summary.divergenceCount > 0 ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
