/**
 * Lot 5 « exploitation » — les simulations SORTENT de l'event loop.
 *
 * Le runner et le calcul des cotes appelaient `simulateMatch` en
 * synchrone : une seconde par match, cinquante par jeu de cotes, et aucune
 * requête servie pendant ce temps. Ce module tient UN pool de
 * `worker_threads` (`@bb/sim-engine`, `createSimPool`) pour tout le
 * serveur, créé à la première demande.
 *
 *  - `PRO_LEAGUE_SIM_WORKERS` : nombre de workers ; `0` = mode INLINE
 *    (l'ancien comportement, sur l'event loop). Défaut : `cpus − 1`,
 *    borné à [1, 4].
 *  - En test (`NODE_ENV=test`, `TEST_SQLITE=1`) le mode est inline : les
 *    suites espionnent `simulateMatch` et n'ont pas à lancer de threads.
 *  - Le serveur ne persiste que le journal : `fullReplay` (≈ 2 Mo d'états)
 *    n'est pas transféré depuis le worker (`stripFullReplay`).
 */

import os from "node:os";

import {
  createSimPool,
  simulateMatch,
  type SimInput,
  type SimPool,
  type SimPoolOptions,
  type SimResult,
} from "@bb/sim-engine";

import { serverLog } from "../utils/server-log";

export type SimPoolMode = "inline" | "pool";

export interface ServerSimPoolStats {
  readonly mode: SimPoolMode;
  readonly size: number;
  readonly busy: number;
  readonly queued: number;
  readonly completed: number;
  readonly failed: number;
  readonly respawned: number;
}

export const MAX_DEFAULT_WORKERS = 4;

/** Pur : taille du pool d'après l'environnement (0 = inline). */
export function resolveSimPoolSize(
  env: Readonly<Record<string, string | undefined>> = process.env,
  cpus: number = typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : os.cpus().length,
): number {
  if (env.NODE_ENV === "test" || env.TEST_SQLITE === "1") return 0;
  const raw = env.PRO_LEAGUE_SIM_WORKERS;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return Math.max(1, Math.min(MAX_DEFAULT_WORKERS, cpus - 1));
}

let pool: SimPool | null = null;
let poolSize: number | null = null;
let inlineCompleted = 0;
let inlineFailed = 0;

function ensurePool(): SimPool | null {
  if (poolSize === null) poolSize = resolveSimPoolSize();
  if (poolSize === 0) return null;
  if (!pool) {
    pool = createSimPool({ size: poolSize, defaults: { stripFullReplay: true } });
    serverLog.info(`[pro-league-sim-pool] ${poolSize} worker(s) de simulation démarrés`);
  }
  return pool;
}

/** Une simulation hors de l'event loop (ou inline en test / `PRO_LEAGUE_SIM_WORKERS=0`). */
export async function simulateMatchOffLoop(
  input: SimInput,
  options: SimPoolOptions = {},
): Promise<SimResult> {
  const p = ensurePool();
  if (p) return p.simulate(input, options);
  try {
    const result = simulateMatch(input, { driverKind: options.driverKind });
    inlineCompleted += 1;
    return result;
  } catch (e) {
    inlineFailed += 1;
    throw e;
  }
}

/** N simulations, parallélisées sur le pool, résultats dans l'ordre des entrées. */
export async function simulateManyOffLoop(
  inputs: readonly SimInput[],
  options: SimPoolOptions = {},
): Promise<readonly SimResult[]> {
  const p = ensurePool();
  if (p) return p.simulateMany(inputs, options);
  const out: SimResult[] = [];
  for (const input of inputs) out.push(await simulateMatchOffLoop(input, options));
  return out;
}

export function getSimPoolStats(): ServerSimPoolStats {
  if (pool) return { mode: "pool", ...pool.stats() };
  return {
    mode: "inline",
    size: 0,
    busy: 0,
    queued: 0,
    completed: inlineCompleted,
    failed: inlineFailed,
    respawned: 0,
  };
}

export async function shutdownSimPool(): Promise<void> {
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.close();
}

/** Tests : oublie le pool et la taille résolue. */
export async function __resetSimPoolForTesting(): Promise<void> {
  await shutdownSimPool();
  poolSize = null;
  inlineCompleted = 0;
  inlineFailed = 0;
}
