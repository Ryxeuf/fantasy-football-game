#!/usr/bin/env tsx
/**
 * `pnpm sim:loadtest:broadcaster` — Lot 4.C.1.
 *
 * Imprime un rapport de saturation du broadcaster Pro League : N
 * sessions concurrentes × M subscribers × K events. Sert à identifier
 * le seuil de scaling (lag p99 dépasse 100ms ?) avant de devoir
 * activer Phase 4.C.2 (Redis pub/sub multi-instance).
 *
 * Exécution offline : pas de DB, pas de sim-engine, juste une boucle
 * dispatch synthétique avec le même contrat que le broadcaster prod.
 *
 * Usage examples
 * --------------
 *   pnpm sim:loadtest:broadcaster
 *   pnpm sim:loadtest:broadcaster --matches=10 --subscribers=200 --events=50
 *   pnpm sim:loadtest:broadcaster --matches=1 --subscribers=2000 --events=100 --json
 *
 * Options
 *   --matches=<n>      Nombre de sessions concurrentes (default 10).
 *   --subscribers=<n>  Subscribers par session (default 100).
 *   --events=<n>       Events par session (default 50).
 *   --spacing=<ms>     Espacement displayAtMs entre events (default 100).
 *   --tick=<ms>        Granularité du tick interne (default 100).
 *   --json             Output JSON parsable.
 *   --help             Affiche l'aide.
 */

import { parseArgs } from "node:util";

import {
  formatLoadTestReport,
  runBroadcasterLoadTest,
} from "../src/services/pro-league-broadcaster-loadtest";

const HELP = `pnpm sim:loadtest:broadcaster — broadcaster scaling probe

Usage:
  pnpm sim:loadtest:broadcaster [--matches=<n>] [--subscribers=<n>] [--events=<n>] [--spacing=<ms>] [--tick=<ms>] [--json]
  pnpm sim:loadtest:broadcaster --help
`;

interface CliArgs {
  matches?: string;
  subscribers?: string;
  events?: string;
  spacing?: string;
  tick?: string;
  json?: boolean;
  help?: boolean;
}

function parseIntStrict(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`--${name}=${value} : doit être un entier positif`);
  }
  const n = Number.parseInt(value, 10);
  if (n < 0) throw new Error(`--${name}=${value} : doit être >= 0`);
  return n;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      matches: { type: "string" },
      subscribers: { type: "string" },
      events: { type: "string" },
      spacing: { type: "string" },
      tick: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const args = values as CliArgs;
  if (args.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const config = {
    matches: parseIntStrict("matches", args.matches, 10),
    subscribers: parseIntStrict("subscribers", args.subscribers, 100),
    events: parseIntStrict("events", args.events, 50),
    eventSpacingMs: parseIntStrict("spacing", args.spacing, 100),
    tickIntervalMs: parseIntStrict("tick", args.tick, 100),
  };
  const result = await runBroadcasterLoadTest(config);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${formatLoadTestReport(result)}\n`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Erreur: ${msg}\n`);
  process.exit(1);
});
